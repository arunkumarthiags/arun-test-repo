"""When an adversarial-generated EvalCase catches a regression in a gate run,
`promote_to_golden_if_caught_regression` must flip golden=True. Idempotent."""
from __future__ import annotations

import uuid

from gauntlet_api.adversarial.generator import (
    generate_adversarial_batch,
    promote_to_golden_if_caught_regression,
)
from gauntlet_api.models import EvalCase, FailureCluster, Trace


def _seed_failing_trace(db, agent_id: str, cat: str) -> Trace:
    t = Trace(
        agent_id=agent_id,
        version="v1",
        input={"description": "guarantee returns marketing claim"},
        output={"body": "guaranteed risk-free returns"},
        steps=[],
        total_tokens=10,
        total_cost_usd=0.0,
        latency_ms=100,
        scores={"__rollup__": {"passed": False, "overall_score": 0.2}},
        failure_categories=[cat],
        source="production",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def test_promote_adversarial_to_golden(db):
    case = EvalCase(
        agent_id="agent-prom",
        input={"description": "x"},
        rubric="r",
        difficulty=4,
        cluster_tag="compliance_language_failure",
        generation_method="adversarial",
        golden=False,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    promote_to_golden_if_caught_regression(db, case.id)
    db.flush()
    db.refresh(case)
    assert case.golden is True


def test_promote_is_noop_for_human_cases(db):
    case = EvalCase(
        agent_id="agent-prom-h",
        input={"description": "x"},
        rubric="r",
        difficulty=4,
        cluster_tag="compliance_language_failure",
        generation_method="human",
        golden=False,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    promote_to_golden_if_caught_regression(db, case.id)
    db.flush()
    db.refresh(case)
    assert case.golden is False


def test_promote_idempotent_on_already_golden(db):
    case = EvalCase(
        agent_id="agent-prom-g",
        input={"description": "x"},
        rubric="r",
        difficulty=4,
        cluster_tag="x",
        generation_method="adversarial",
        golden=True,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    promote_to_golden_if_caught_regression(db, case.id)  # should be a no-op
    db.flush()
    db.refresh(case)
    assert case.golden is True


def test_promote_missing_id_is_noop(db):
    # Random non-existent UUID — should not raise.
    promote_to_golden_if_caught_regression(db, uuid.uuid4())


def test_generate_adversarial_batch_uses_seed_traces(db):
    agent_id = "agent-genadv"
    cat = "compliance_language_failure"
    trace = _seed_failing_trace(db, agent_id, cat)

    cluster = FailureCluster(
        agent_id=agent_id,
        name=cat,
        description="auto",
        example_trace_ids=[trace.id],
    )
    db.add(cluster)
    db.commit()
    db.refresh(cluster)

    cases = generate_adversarial_batch(db, cluster)
    # All four strategies fire: paraphrase (~10) + persona (5) + edge (5) + complexity (3)
    assert len(cases) > 10
    strategies = {c["strategy"] for c in cases}
    assert strategies == {
        "semantic_paraphrase",
        "persona_variation",
        "edge_case_injection",
        "complexity_escalation",
    }
    # Lineage fields
    for c in cases:
        assert c["cluster_tag"] == cat
        assert "parent_trace_id" in c
        assert "tag" in c


def test_generate_adversarial_falls_back_to_query(db):
    """When the cluster has no example_trace_ids, the generator falls back to
    a DB query for low-scoring traces in the category."""
    agent_id = "agent-genadv2"
    cat = "tool_selection_error"
    _seed_failing_trace(db, agent_id, cat)

    cluster = FailureCluster(
        agent_id=agent_id,
        name=cat,
        description="auto",
        example_trace_ids=[],
    )
    db.add(cluster)
    db.commit()
    db.refresh(cluster)

    cases = generate_adversarial_batch(db, cluster)
    assert len(cases) > 0
