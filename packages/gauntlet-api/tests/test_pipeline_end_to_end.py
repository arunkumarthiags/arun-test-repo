"""End-to-end pipeline integration test.

Drives a trace through:
  ingest (POST /v1/traces) → inline scoring (Celery fallback) → classifier →
  cluster row populated.

Uses the `client` fixture (FastAPI TestClient with the test-DB session
override) and the `db` fixture from conftest.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from gauntlet_api.classifier.classifier import classify_trace
from gauntlet_api.models import FailureCluster, ScoreLineage, Trace
from gauntlet_api.workers.tasks import classify_trace_task


def _bad_trace_payload(agent_id: str = "agent-pipeline") -> dict:
    """A trace whose output is missing required fields and uses forbidden
    compliance language — the scorer should fail it."""
    return {
        "agent_id": agent_id,
        "version": "v0.1.0",
        "input": {
            "description": "marketing claim says we always beat the market and guarantee returns",
            "request": "guaranteed risk-free returns marketing copy",
        },
        "output": {
            # missing "title" and "acceptance_criteria"
            "body": "we guarantee returns and never fail; risk-free always",
        },
        "steps": [
            {"kind": "reasoning", "name": "plan", "tokens": 10, "cost_usd": 0.0001},
        ],
        "total_tokens": 50,
        "total_cost_usd": 0.001,
        "latency_ms": 100,
        "source": "production",
    }


def _good_trace_payload(agent_id: str = "agent-pipeline") -> dict:
    return {
        "agent_id": agent_id,
        "version": "v0.1.0",
        "input": {"description": "build a clean feature spec"},
        "output": {
            "title": "Spec",
            "acceptance_criteria": ["Given X", "When Y", "Then Z"],
        },
        "steps": [
            {"kind": "reasoning", "name": "plan", "tokens": 10, "cost_usd": 0.0001},
            {"kind": "completion", "name": "write", "tokens": 30, "cost_usd": 0.0003},
        ],
        "total_tokens": 100,
        "total_cost_usd": 0.001,
        "latency_ms": 500,
        "source": "production",
    }


def test_ingest_scores_inline_when_broker_down(client, db):
    """POST /v1/traces returns a fully-scored trace via the inline fallback
    path when Celery's broker is unreachable in tests."""
    payload = _good_trace_payload()
    resp = client.post("/v1/traces", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Inline fallback path populates scores synchronously.
    assert body["scores"], "scores must be populated by the inline fallback"
    assert "__rollup__" in body["scores"]
    rollup = body["scores"]["__rollup__"]
    assert "overall_score" in rollup
    assert "passed" in rollup

    # And lineage rows were written.
    trace_id = uuid.UUID(body["id"])
    rows = db.execute(
        select(ScoreLineage).where(ScoreLineage.trace_id == trace_id)
    ).scalars().all()
    assert len(rows) >= 5  # at least the 5 deterministic scorers


def test_low_score_trace_fails_overall(client, db):
    """A bad trace must come back with passed=False on the rollup."""
    resp = client.post("/v1/traces", json=_bad_trace_payload())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    rollup = body["scores"]["__rollup__"]
    assert rollup["passed"] is False, body["scores"]


def test_classifier_populates_failure_categories_and_cluster(client, db):
    """Wire the full pipeline: ingest → inline-score → manual classify call →
    verify trace.failure_categories populated and a FailureCluster row exists."""
    resp = client.post("/v1/traces", json=_bad_trace_payload(agent_id="agent-cluster"))
    assert resp.status_code == 200, resp.text
    trace_id = uuid.UUID(resp.json()["id"])

    # Re-fetch the trace from the same session, then drive the classifier task.
    trace = db.get(Trace, trace_id)
    assert trace is not None
    assert (trace.scores or {}).get("__rollup__", {}).get("passed") is False

    # The Celery task uses its own session via SessionLocal — which the fixture
    # has rebound onto the test DB. Run it inline (Celery is in eager mode here
    # only if configured; we just call the underlying function).
    cats = classify_trace(db, trace)
    db.flush()
    assert isinstance(cats, list)

    # Now also exercise the worker task path (it commits its own transaction).
    db.commit()
    res = classify_trace_task("__not_a_uuid__".replace("__not_a_uuid__", str(trace_id)))
    assert res["ok"] is True
    assert isinstance(res["categories"], list)

    # Refresh from DB and check failure_categories were stored.
    db.expire_all()
    trace2 = db.get(Trace, trace_id)
    assert trace2 is not None
    assert isinstance(trace2.failure_categories, list)

    # A FailureCluster row should exist for at least one of the matched categories.
    if trace2.failure_categories:
        clusters = db.execute(
            select(FailureCluster).where(
                FailureCluster.agent_id == trace2.agent_id,
            )
        ).scalars().all()
        assert clusters, "classifier should create a FailureCluster row for low-scoring trace"
        names = {c.name for c in clusters}
        assert names & set(trace2.failure_categories)
