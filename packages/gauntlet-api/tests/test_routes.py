"""Smoke tests for every router: GET key endpoints, sanity-check shapes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from gauntlet_api.models import (
    AdversarialJob,
    DriftSample,
    EvalCase,
    FailureCluster,
    GateRun,
    Trace,
)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_settings_route(client):
    r = client.get("/v1/settings")
    assert r.status_code == 200
    body = r.json()
    assert "judge_model" in body
    assert "alerts" in body
    assert {"slack", "pagerduty", "webhook"} <= set(body["alerts"].keys())


def test_clusters_routes(client, db):
    # No rows yet
    r = client.get("/v1/clusters")
    assert r.status_code == 200
    assert r.json() == []

    # Seed a cluster
    cluster = FailureCluster(
        agent_id="agent-x",
        name="hallucination",
        description="foo",
        count_7d=4,
        count_30d=10,
        example_trace_ids=[],
    )
    db.add(cluster)
    db.commit()

    r = client.get("/v1/clusters", params={"agent_id": "agent-x"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["name"] == "hallucination"

    # distribution
    r = client.get("/v1/clusters/distribution", params={"agent_id": "agent-x"})
    assert r.status_code == 200
    dist = r.json()
    assert dist["agent_id"] == "agent-x"
    assert dist["total"] >= 1
    assert isinstance(dist["buckets"], list)

    # Create + rename via the routes themselves.
    r = client.post(
        "/v1/clusters",
        json={"agent_id": "agent-x", "name": "new-cluster", "description": "d"},
    )
    assert r.status_code == 200
    cid = r.json()["id"]
    r = client.patch(f"/v1/clusters/{cid}", json={"description": "renamed"})
    assert r.status_code == 200
    assert r.json()["description"] == "renamed"

    # cluster examples (empty list of trace IDs)
    r = client.get(f"/v1/clusters/{cid}/examples")
    assert r.status_code == 200

    # 404 paths for cluster routes
    r = client.patch(f"/v1/clusters/{uuid.uuid4()}", json={"name": "x"})
    assert r.status_code == 404
    r = client.get(f"/v1/clusters/{uuid.uuid4()}/examples")
    assert r.status_code == 404


def test_clusters_merge(client, db):
    a = FailureCluster(agent_id="agent-mg", name="cat-a", description="A")
    b = FailureCluster(agent_id="agent-mg", name="cat-b", description="B")
    db.add(a)
    db.add(b)
    db.commit()
    db.refresh(a)
    db.refresh(b)

    # Seed a trace tagged with cat-b so the merge rewrites failure_categories.
    t = Trace(
        agent_id="agent-mg", version="v", input={}, output={}, steps=[],
        total_tokens=0, total_cost_usd=0, latency_ms=0,
        scores={}, failure_categories=["cat-b"], source="production",
    )
    db.add(t)
    db.commit()

    r = client.post(f"/v1/clusters/{a.id}/merge/{b.id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == str(a.id)

    # Merging from a different agent → 409
    other = FailureCluster(agent_id="other-agent", name="cat-c", description="C")
    db.add(other)
    db.commit()
    db.refresh(other)
    r = client.post(f"/v1/clusters/{a.id}/merge/{other.id}")
    assert r.status_code == 409

    # 404 paths for merge
    r = client.post(f"/v1/clusters/{uuid.uuid4()}/merge/{uuid.uuid4()}")
    assert r.status_code == 404


def test_traces_list_and_get(client, db):
    t = Trace(
        agent_id="agent-trlist", version="v", input={}, output={}, steps=[],
        total_tokens=0, total_cost_usd=0, latency_ms=0,
        scores={}, failure_categories=[], source="production",
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    r = client.get("/v1/traces", params={"agent_id": "agent-trlist", "source": "production"})
    assert r.status_code == 200
    body = r.json()
    assert any(row["id"] == str(t.id) for row in body)

    r = client.get(f"/v1/traces/{t.id}")
    assert r.status_code == 200
    assert r.json()["id"] == str(t.id)

    r = client.get(f"/v1/traces/{uuid.uuid4()}")
    assert r.status_code == 404


def test_eval_cases_filters(client, db):
    case = EvalCase(
        agent_id="agent-fil",
        input={"description": "x"},
        rubric="r",
        difficulty=4,
        cluster_tag="cat-1",
        generation_method="adversarial",
        golden=True,
    )
    db.add(case)
    db.commit()
    r = client.get("/v1/eval-cases", params={
        "agent_id": "agent-fil",
        "cluster_tag": "cat-1",
        "generation_method": "adversarial",
        "golden": True,
        "difficulty": 4,
    })
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Cannot delete a golden case → 409
    r = client.delete(f"/v1/eval-cases/{case.id}")
    assert r.status_code == 409
    # Patch missing case → 404
    r = client.patch(f"/v1/eval-cases/{uuid.uuid4()}", json={"rubric": "x"})
    assert r.status_code == 404
    # Delete missing case → 404
    r = client.delete(f"/v1/eval-cases/{uuid.uuid4()}")
    assert r.status_code == 404


def test_eval_cases_routes(client):
    payload = {
        "agent_id": "agent-ev",
        "input": {"description": "thing"},
        "rubric": "do the thing",
        "difficulty": 3,
        "cluster_tag": "x",
    }
    r = client.post("/v1/eval-cases", json=payload)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]

    r = client.get("/v1/eval-cases", params={"agent_id": "agent-ev"})
    assert r.status_code == 200
    assert any(c["id"] == cid for c in r.json())

    r = client.get(f"/v1/eval-cases/{cid}")
    assert r.status_code == 200

    r = client.patch(f"/v1/eval-cases/{cid}", json={"difficulty": 5, "rubric": "harder"})
    assert r.status_code == 200
    assert r.json()["difficulty"] == 5
    assert r.json()["rubric"] == "harder"

    r = client.delete(f"/v1/eval-cases/{cid}")
    assert r.status_code == 200

    # Fetching a missing case is 404
    r = client.get(f"/v1/eval-cases/{uuid.uuid4()}")
    assert r.status_code == 404


def test_runs_route(client, db):
    db.add(
        GateRun(
            agent_id="agent-r",
            agent_version="v1",
            corpus_hash="x" * 64,
            pass_rate=0.95,
            regressions=[],
            cost_usd=0.1,
            cost_delta_usd=0.0,
            latency_p50_ms=200,
            latency_delta_ms=0,
            report={},
            cached=False,
        )
    )
    db.commit()
    r = client.get("/v1/runs")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert any(row["agent_id"] == "agent-r" for row in body)


def test_drift_routes(client, db):
    agent_id = "agent-d"
    db.add(
        GateRun(
            agent_id=agent_id,
            agent_version="vb",
            corpus_hash="y" * 64,
            pass_rate=0.9,
            regressions=[],
            cost_usd=0.0,
            cost_delta_usd=0.0,
            latency_p50_ms=100,
            latency_delta_ms=0,
            report={},
            cached=False,
        )
    )
    db.commit()
    r = client.get(f"/v1/drift/{agent_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["agent_id"] == agent_id
    assert "delta_pct" in body
    assert "threshold_pct" in body

    # Timeseries (with a sample row)
    trace = Trace(
        agent_id=agent_id, version="v1", input={}, output={}, steps=[],
        total_tokens=0, total_cost_usd=0, latency_ms=0,
        scores={}, failure_categories=[], source="production",
    )
    db.add(trace)
    db.commit()
    db.refresh(trace)
    db.add(DriftSample(
        agent_id=agent_id,
        trace_id=trace.id,
        pass_rate_window_7d=0.7,
        eval_pass_rate_baseline=0.9,
        delta_pct=20.0,
        alert_fired=True,
    ))
    db.commit()

    r = client.get(f"/v1/drift/{agent_id}/timeseries")
    assert r.status_code == 200
    assert r.json()["agent_id"] == agent_id
    assert len(r.json()["points"]) >= 1


def test_adversarial_routes(client, db):
    cluster = FailureCluster(agent_id="agent-a", name="cat-a", description="x")
    db.add(cluster)
    db.commit()
    db.refresh(cluster)

    job = AdversarialJob(
        cluster_id=cluster.id,
        status="review",
        generated_cases=[
            {
                "input": {"description": "v1"},
                "rubric": "r",
                "difficulty": 4,
                "strategy": "edge_case_injection",
                "cluster_tag": "cat-a",
                "parent_case_id": None,
                "parent_trace_id": str(uuid.uuid4()),
                "tag": "tag1",
            }
        ],
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    r = client.get("/v1/adversarial/jobs")
    assert r.status_code == 200
    assert any(j["id"] == str(job.id) for j in r.json())

    r = client.get(f"/v1/adversarial/jobs/{job.id}")
    assert r.status_code == 200
    assert r.json()["id"] == str(job.id)

    r = client.get(f"/v1/adversarial/queue/by-cluster/{cluster.id}")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Approve case index 0 → promotes to EvalCase, status flips to approved.
    r = client.post(
        f"/v1/adversarial/jobs/{job.id}/decide",
        json={"approvals": {"0": True}, "notes": "lgtm"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["promoted_count"] == 1

    # 404 paths
    r = client.get(f"/v1/adversarial/jobs/{uuid.uuid4()}")
    assert r.status_code == 404
    r = client.post(
        f"/v1/adversarial/jobs/{uuid.uuid4()}/decide",
        json={"approvals": {}},
    )
    assert r.status_code == 404


def test_gate_route(client, db):
    db.add(
        EvalCase(
            agent_id="agent-gateroute",
            input={"description": "x"},
            rubric="r",
            difficulty=2,
        )
    )
    db.commit()
    r = client.post(
        "/v1/gate",
        json={"agent_id": "agent-gateroute", "agent_version": "v1"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["agent_id"] == "agent-gateroute"
    assert "pass_rate" in body
    assert "corpus_hash" in body
