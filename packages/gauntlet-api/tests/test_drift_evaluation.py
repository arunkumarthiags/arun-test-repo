"""Drift monitor: with seeded prod traces of known pass/fail and a baseline
gate run, compute_drift_report should return delta_pct = (eval - prod) * 100."""
from __future__ import annotations

from datetime import datetime, timezone

import gauntlet_api.drift.monitor as drift_mod
from gauntlet_api.drift.monitor import (
    _enqueue_prod_failure_for_adversarial,
    _fire_alerts,
    compute_drift_report,
    evaluate_drift,
)
from gauntlet_api.models import FailureCluster, GateRun, Trace


def _seed_gate_baseline(db, agent_id: str, pass_rate: float) -> None:
    db.add(GateRun(
        agent_id=agent_id,
        agent_version="vbase",
        corpus_hash="deadbeef" * 8,
        pass_rate=pass_rate,
        regressions=[],
        cost_usd=0.0,
        cost_delta_usd=0.0,
        latency_p50_ms=100,
        latency_delta_ms=0,
        report={"pass_rate": pass_rate},
        cached=False,
    ))
    db.commit()


def _seed_prod_trace(db, agent_id: str, *, passed: bool) -> Trace:
    rollup = {"overall_score": 0.9 if passed else 0.2, "passed": passed,
              "pass_threshold": 0.7, "scored_at": datetime.now(timezone.utc).isoformat()}
    t = Trace(
        agent_id=agent_id,
        version="v1",
        input={"x": 1},
        output={"title": "t", "acceptance_criteria": ["a"]},
        steps=[],
        total_tokens=10,
        total_cost_usd=0.0,
        latency_ms=200,
        scores={"__rollup__": rollup},
        failure_categories=[],
        source="production",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def test_drift_delta_matches_pass_rates(db):
    agent_id = "agent-drift"
    # Baseline (eval) pass rate = 1.0
    _seed_gate_baseline(db, agent_id, pass_rate=1.0)
    # 4 prod traces: 1 passed, 3 failed → prod pass rate 0.25
    for _ in range(1):
        _seed_prod_trace(db, agent_id, passed=True)
    for _ in range(3):
        _seed_prod_trace(db, agent_id, passed=False)

    report = compute_drift_report(db, agent_id=agent_id)
    assert report.eval_pass_rate == 1.0
    assert abs(report.prod_pass_rate_7d - 0.25) < 1e-6
    assert abs(report.delta_pct - 75.0) < 1e-6


def test_drift_no_baseline_defaults_to_one(db):
    agent_id = "agent-drift-nobase"
    _seed_prod_trace(db, agent_id, passed=False)
    report = compute_drift_report(db, agent_id=agent_id)
    # No GateRun row → eval baseline is 1.0
    assert report.eval_pass_rate == 1.0
    assert report.prod_pass_rate_7d == 0.0
    assert report.delta_pct == 100.0


def test_drift_no_prod_traces(db):
    agent_id = "agent-drift-empty"
    _seed_gate_baseline(db, agent_id, pass_rate=0.85)
    report = compute_drift_report(db, agent_id=agent_id)
    assert report.eval_pass_rate == 0.85
    assert report.prod_pass_rate_7d == 0.0


def test_evaluate_drift_returns_sample(db):
    """evaluate_drift takes a single trace and returns a DriftSample row + an
    optional alert payload. With a high-delta scenario the alert fires."""
    agent_id = "agent-drift-alert"
    _seed_gate_baseline(db, agent_id, pass_rate=1.0)
    # Seed lots of failing prod traces so prod_pass_rate is 0%.
    for _ in range(5):
        _seed_prod_trace(db, agent_id, passed=False)

    failing = _seed_prod_trace(db, agent_id, passed=False)
    sample, alert = evaluate_drift(db, failing)
    assert sample.agent_id == agent_id
    assert sample.eval_pass_rate_baseline == 1.0
    assert sample.pass_rate_window_7d == 0.0
    assert sample.delta_pct == 100.0
    # threshold defaults to 10pp; 100pp > 10pp → alert fires.
    assert sample.alert_fired is True
    assert alert is not None
    assert alert["agent_id"] == agent_id


def test_fire_alerts_swallows_network_errors(monkeypatch):
    """_fire_alerts must never raise on transport errors — alerting is
    best-effort and must not block ingestion."""
    from gauntlet_api.config import get_settings

    # Force all three transports to be configured so we exercise each branch.
    s = get_settings()
    monkeypatch.setattr(s, "drift_webhook_url", "https://example.invalid/webhook")
    monkeypatch.setattr(s, "slack_webhook_url", "https://example.invalid/slack")
    monkeypatch.setattr(s, "pagerduty_routing_key", "pd-key-test")

    def boom(*a, **kw):
        raise RuntimeError("simulated network down")

    monkeypatch.setattr(drift_mod.httpx, "post", boom)

    # No exception should escape.
    _fire_alerts({
        "agent_id": "agent-x",
        "eval_pass_rate": 1.0,
        "prod_pass_rate_7d": 0.5,
        "delta_pct": 50.0,
        "top_failing_cluster": "x",
        "drift_dashboard_url": "/x",
    })


def test_enqueue_prod_failure_for_adversarial_no_categories(db):
    t = Trace(
        agent_id="agent-noenq", version="v", input={}, output={},
        steps=[], total_tokens=0, total_cost_usd=0, latency_ms=0,
        scores={}, failure_categories=[], source="production",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    # Should be a no-op without raising.
    _enqueue_prod_failure_for_adversarial(db, t)


def test_enqueue_prod_failure_appends_example(db, monkeypatch):
    agent_id = "agent-enqex"
    cat = "compliance_language_failure"
    t = Trace(
        agent_id=agent_id, version="v", input={}, output={},
        steps=[], total_tokens=0, total_cost_usd=0, latency_ms=0,
        scores={}, failure_categories=[cat], source="production",
    )
    db.add(t)
    cluster = FailureCluster(
        agent_id=agent_id, name=cat, description="x", example_trace_ids=[],
    )
    db.add(cluster)
    db.commit()
    db.refresh(t)
    db.refresh(cluster)

    # Stub Celery .delay so no Redis is needed — function still walks the
    # success path that updates examples + adversarial_queue_triggered_at.
    from gauntlet_api.workers import tasks as tasks_mod
    monkeypatch.setattr(
        tasks_mod.generate_adversarial_task,
        "delay",
        lambda *a, **kw: None,
    )

    _enqueue_prod_failure_for_adversarial(db, t)
    # The function mutates in-memory and relies on the caller to commit. Don't
    # refresh — that would re-read from DB and discard the unflushed change.
    assert t.id in (cluster.example_trace_ids or [])
    assert cluster.adversarial_queue_triggered_at is not None


def test_enqueue_prod_failure_no_cluster(db):
    """Trace has a failure_category but no FailureCluster row exists yet → no-op."""
    t = Trace(
        agent_id="agent-noclus", version="v", input={}, output={},
        steps=[], total_tokens=0, total_cost_usd=0, latency_ms=0,
        scores={}, failure_categories=["unknown_cat"], source="production",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    _enqueue_prod_failure_for_adversarial(db, t)  # no row → silent return
