"""Gate caching: same (corpus_hash, agent_id, agent_version) → cached=True.

Determinism is the gate's hard contract. This test exercises the full
flow: seed eval cases → run_gate (cache miss) → run_gate again (cache hit)
→ mutate the corpus → run_gate (cache miss again).
"""
from __future__ import annotations

from sqlalchemy import select

from gauntlet_api.gate.gate import run_gate
from gauntlet_api.models import EvalCase, GateRun


def _seed_corpus(db, agent_id: str, n: int = 4) -> list[EvalCase]:
    cases: list[EvalCase] = []
    for i in range(n):
        c = EvalCase(
            agent_id=agent_id,
            input={"description": f"build feature {i}", "request": f"feature_{i}"},
            rubric=f"Rubric for case {i}: deliver a complete, compliant story.",
            difficulty=2 + (i % 3),
            cluster_tag="seeded",
            generation_method="human",
            golden=False,
        )
        db.add(c)
        cases.append(c)
    db.commit()
    return cases


def test_second_call_returns_cached(db):
    agent_id = "agent-cache"
    agent_version = "v1.2.3"
    _seed_corpus(db, agent_id)

    first = run_gate(db, agent_id=agent_id, agent_version=agent_version)
    assert first.cached is False

    # Persisted exactly one row
    rows = db.execute(
        select(GateRun).where(
            GateRun.agent_id == agent_id, GateRun.agent_version == agent_version
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].corpus_hash == first.corpus_hash

    second = run_gate(db, agent_id=agent_id, agent_version=agent_version)
    assert second.cached is True
    assert second.corpus_hash == first.corpus_hash
    assert second.pass_rate == first.pass_rate
    # No additional GateRun row written on cache hit.
    rows2 = db.execute(
        select(GateRun).where(
            GateRun.agent_id == agent_id, GateRun.agent_version == agent_version
        )
    ).scalars().all()
    assert len(rows2) == 1


def test_changing_corpus_invalidates_cache(db):
    agent_id = "agent-cache-mut"
    agent_version = "v1.0.0"
    cases = _seed_corpus(db, agent_id, n=3)
    first = run_gate(db, agent_id=agent_id, agent_version=agent_version)
    assert first.cached is False

    # Mutate the corpus: add a new case → corpus_hash changes.
    db.add(
        EvalCase(
            agent_id=agent_id,
            input={"description": "an entirely new requirement"},
            rubric="new rubric",
            difficulty=4,
            cluster_tag="seeded",
        )
    )
    db.commit()

    third = run_gate(db, agent_id=agent_id, agent_version=agent_version)
    assert third.cached is False
    assert third.corpus_hash != first.corpus_hash

    # And there should now be two GateRun rows.
    rows = db.execute(
        select(GateRun).where(
            GateRun.agent_id == agent_id, GateRun.agent_version == agent_version
        )
    ).scalars().all()
    assert len(rows) == 2


def test_different_version_misses_cache(db):
    agent_id = "agent-cache-v"
    _seed_corpus(db, agent_id)
    a = run_gate(db, agent_id=agent_id, agent_version="v1")
    b = run_gate(db, agent_id=agent_id, agent_version="v2")
    assert a.cached is False
    assert b.cached is False
    assert a.corpus_hash == b.corpus_hash  # same corpus
