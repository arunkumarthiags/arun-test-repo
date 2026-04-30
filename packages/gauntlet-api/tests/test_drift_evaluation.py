"""Drift monitor: with seeded prod traces of known pass/fail and a baseline
gate run, compute_drift_report should return delta_pct = (eval - prod) * 100."""
from __future__ import annotations

from datetime import datetime, timezone

from gauntlet_api.drift.monitor import compute_drift_report, evaluate_drift
from gauntlet_api.models import GateRun, Trace


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
