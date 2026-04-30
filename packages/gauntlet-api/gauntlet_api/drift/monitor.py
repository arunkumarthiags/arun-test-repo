"""Drift monitor — sample production at drift_sample_rate, compute eval-vs-prod
gap on rolling windows, alert and auto-enqueue failing prod traces back into
the adversarial generator (closes the loop)."""
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Iterable

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import DriftSample, FailureCluster, GateRun, Trace
from ..schemas import DriftReport


def _passed(trace: Trace) -> bool:
    rollup = (trace.scores or {}).get("__rollup__") or {}
    return bool(rollup.get("passed", False))


def _pass_rate(traces: Iterable[Trace]) -> float:
    traces = list(traces)
    if not traces:
        return 0.0
    return sum(1 for t in traces if _passed(t)) / len(traces)


def _eval_baseline(db: Session, agent_id: str) -> float:
    """Use the most recent gate run's pass rate as the eval baseline."""
    row = db.execute(
        select(GateRun)
        .where(GateRun.agent_id == agent_id)
        .order_by(GateRun.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    return float(row.pass_rate) if row else 1.0


def _prod_pass_rate_7d(db: Session, agent_id: str) -> float:
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    rows = db.execute(
        select(Trace).where(
            Trace.agent_id == agent_id,
            Trace.source == "production",
            Trace.timestamp >= cutoff,
        )
    ).scalars().all()
    return _pass_rate(rows)


def _top_failing_cluster(db: Session, agent_id: str) -> str | None:
    cluster = db.execute(
        select(FailureCluster)
        .where(FailureCluster.agent_id == agent_id)
        .order_by(FailureCluster.count_7d.desc())
        .limit(1)
    ).scalar_one_or_none()
    return cluster.name if cluster else None


def evaluate_drift(db: Session, trace: Trace) -> tuple[DriftSample, dict | None]:
    """For one sampled production trace: compute the rolling delta and decide
    whether to fire alerts. Returns (sample_row, alert_payload_or_None)."""
    settings = get_settings()
    eval_pr = _eval_baseline(db, trace.agent_id)
    prod_pr = _prod_pass_rate_7d(db, trace.agent_id)
    delta_pct = round((eval_pr - prod_pr) * 100.0, 2)

    alert_fired = delta_pct > settings.drift_alert_threshold_pct
    alert_payload = None
    if alert_fired:
        alert_payload = {
            "agent_id": trace.agent_id,
            "eval_pass_rate": eval_pr,
            "prod_pass_rate_7d": prod_pr,
            "delta_pct": delta_pct,
            "top_failing_cluster": _top_failing_cluster(db, trace.agent_id),
            "drift_dashboard_url": f"/drift/{trace.agent_id}",
        }
        _fire_alerts(alert_payload)
        # Close the loop: enqueue this failing prod trace into the adversarial
        # queue so the next eval corpus already covers what just escaped.
        if not _passed(trace):
            _enqueue_prod_failure_for_adversarial(db, trace)

    sample = DriftSample(
        agent_id=trace.agent_id,
        trace_id=trace.id,
        pass_rate_window_7d=prod_pr,
        eval_pass_rate_baseline=eval_pr,
        delta_pct=delta_pct,
        alert_fired=alert_fired,
    )
    return sample, alert_payload


def compute_drift_report(db: Session, *, agent_id: str) -> DriftReport:
    settings = get_settings()
    eval_pr = _eval_baseline(db, agent_id)
    prod_pr = _prod_pass_rate_7d(db, agent_id)
    delta_pct = round((eval_pr - prod_pr) * 100.0, 2)
    return DriftReport(
        agent_id=agent_id,
        eval_pass_rate=eval_pr,
        prod_pass_rate_7d=prod_pr,
        delta_pct=delta_pct,
        threshold_pct=settings.drift_alert_threshold_pct,
        top_failing_cluster=_top_failing_cluster(db, agent_id),
        alert_fired=delta_pct > settings.drift_alert_threshold_pct,
    )


def _fire_alerts(payload: dict) -> None:
    settings = get_settings()
    targets: list[tuple[str, dict]] = []
    if settings.drift_webhook_url:
        targets.append((settings.drift_webhook_url, payload))
    if settings.slack_webhook_url:
        targets.append((settings.slack_webhook_url, {
            "text": (
                f":rotating_light: *Gauntlet drift* — `{payload['agent_id']}` "
                f"prod pass rate {payload['prod_pass_rate_7d']:.1%} vs eval "
                f"{payload['eval_pass_rate']:.1%} — Δ {payload['delta_pct']}pp. "
                f"Top failing cluster: *{payload.get('top_failing_cluster')}*."
            )
        }))
    if settings.pagerduty_routing_key:
        targets.append(("https://events.pagerduty.com/v2/enqueue", {
            "routing_key": settings.pagerduty_routing_key,
            "event_action": "trigger",
            "payload": {
                "summary": f"Gauntlet drift alert for {payload['agent_id']} (Δ {payload['delta_pct']}pp)",
                "severity": "warning",
                "source": "gauntlet",
                "custom_details": payload,
            },
        }))

    for url, body in targets:
        try:
            httpx.post(url, content=json.dumps(body, default=str),
                       headers={"Content-Type": "application/json"}, timeout=3.0)
        except Exception:
            # Alerting is best-effort — never block ingestion.
            pass


def _enqueue_prod_failure_for_adversarial(db: Session, trace: Trace) -> None:
    """If the failing prod trace's category has a cluster, trigger a generation
    job so prod failures harden the corpus before the next deploy."""
    if not trace.failure_categories:
        return
    cat = trace.failure_categories[0]
    cluster = db.execute(
        select(FailureCluster).where(
            FailureCluster.agent_id == trace.agent_id,
            FailureCluster.name == cat,
        )
    ).scalar_one_or_none()
    if not cluster:
        return
    examples = list(cluster.example_trace_ids or [])
    if trace.id not in examples:
        examples = (examples + [trace.id])[-20:]
        cluster.example_trace_ids = examples
    cluster.adversarial_queue_triggered_at = datetime.now(timezone.utc)
    try:
        from ..workers.tasks import generate_adversarial_task
        generate_adversarial_task.delay(str(cluster.id))
    except Exception:
        pass
