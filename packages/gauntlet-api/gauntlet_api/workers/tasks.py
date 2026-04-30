"""Celery tasks: scoring → classify → adversarial → drift.

Each task closes over a fresh DB session and is idempotent on re-delivery
(uses primary keys / INSERT … ON CONFLICT semantics where applicable).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ..adversarial.generator import generate_adversarial_batch
from ..classifier.classifier import classify_trace
from ..config import get_settings
from ..db import SessionLocal
from ..drift.monitor import evaluate_drift
from ..models import (
    AdversarialJob,
    DriftSample,
    FailureCluster,
    Trace,
)
from ..scorers.engine import score_trace
from .celery_app import celery_app


@celery_app.task(name="gauntlet.score_trace")
def score_trace_task(trace_id: str) -> dict:
    with SessionLocal() as db:
        trace = db.get(Trace, uuid.UUID(trace_id))
        if not trace:
            return {"ok": False, "reason": "trace_not_found"}
        result = score_trace(db, trace)
        db.commit()

        # Low score → enqueue classification.
        overall = result.get("overall_pass_rate", 1.0)
        if overall < 1.0:
            classify_trace_task.delay(trace_id)

        # Production source → maybe sample for drift.
        if trace.source == "production":
            drift_sample_task.delay(trace_id)

        return {"ok": True, "scores": result}


@celery_app.task(name="gauntlet.classify_trace")
def classify_trace_task(trace_id: str) -> dict:
    settings = get_settings()
    with SessionLocal() as db:
        trace = db.get(Trace, uuid.UUID(trace_id))
        if not trace:
            return {"ok": False, "reason": "trace_not_found"}

        categories = classify_trace(db, trace)
        trace.failure_categories = categories
        db.flush()

        # Update cluster counters and check the threshold.
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        triggered_clusters: list[str] = []

        for cat in categories:
            cluster = db.execute(
                select(FailureCluster).where(
                    FailureCluster.agent_id == trace.agent_id,
                    FailureCluster.name == cat,
                )
            ).scalar_one_or_none()
            if cluster is None:
                cluster = FailureCluster(
                    agent_id=trace.agent_id, name=cat,
                    description=f"Auto-detected cluster: {cat}",
                    example_trace_ids=[trace.id],
                )
                db.add(cluster)
                db.flush()

            # Recompute window counts.
            from sqlalchemy import func as _func
            cluster.count_7d = db.execute(
                select(_func.count()).select_from(Trace).where(
                    Trace.agent_id == trace.agent_id,
                    Trace.failure_categories.any(cat),
                    Trace.timestamp >= seven_days_ago,
                )
            ).scalar_one()
            cluster.count_30d = db.execute(
                select(_func.count()).select_from(Trace).where(
                    Trace.agent_id == trace.agent_id,
                    Trace.failure_categories.any(cat),
                    Trace.timestamp >= thirty_days_ago,
                )
            ).scalar_one()

            # Append example, dedupe, cap at 20.
            examples = list(cluster.example_trace_ids or [])
            if trace.id not in examples:
                examples = (examples + [trace.id])[-20:]
                cluster.example_trace_ids = examples

            # Threshold trigger.
            if (
                cluster.count_7d >= settings.cluster_failure_threshold_7d
                and cluster.adversarial_queue_triggered_at is None
            ):
                cluster.adversarial_queue_triggered_at = datetime.now(timezone.utc)
                triggered_clusters.append(str(cluster.id))

        db.commit()

        for cid in triggered_clusters:
            generate_adversarial_task.delay(cid)

        return {"ok": True, "categories": categories, "triggered": triggered_clusters}


@celery_app.task(name="gauntlet.generate_adversarial")
def generate_adversarial_task(cluster_id: str) -> dict:
    with SessionLocal() as db:
        cluster = db.get(FailureCluster, uuid.UUID(cluster_id))
        if not cluster:
            return {"ok": False, "reason": "cluster_not_found"}

        job = AdversarialJob(cluster_id=cluster.id, status="running")
        db.add(job)
        db.flush()

        cases = generate_adversarial_batch(db, cluster)
        job.generated_cases = cases
        job.status = "review"
        db.commit()

        return {"ok": True, "job_id": str(job.id), "n_cases": len(cases)}


@celery_app.task(name="gauntlet.drift_sample")
def drift_sample_task(trace_id: str) -> dict:
    settings = get_settings()
    import random
    if random.random() > settings.drift_sample_rate:
        return {"ok": True, "skipped": True}

    with SessionLocal() as db:
        trace = db.get(Trace, uuid.UUID(trace_id))
        if not trace:
            return {"ok": False, "reason": "trace_not_found"}

        sample, alert = evaluate_drift(db, trace)
        db.add(sample)
        db.commit()
        return {"ok": True, "alert_fired": bool(alert), "delta_pct": sample.delta_pct}
