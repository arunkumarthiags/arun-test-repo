"""Adversarial generator — applies all 4 strategies per failing input and
attaches full lineage (parent_case_id, strategy, difficulty, cluster_tag).

Generated cases land in the AdversarialJob.generated_cases JSONB array with
status=review until a human reviewer approves them — only then are EvalCase
rows created in the corpus.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import EvalCase, FailureCluster, Trace
from .strategies import all_strategies


def _select_seed_traces(db: Session, cluster: FailureCluster, n: int = 3) -> list[Trace]:
    """Pick the seed failing traces to expand from. Prefer the example_trace_ids
    on the cluster; fall back to recent low-scoring traces in this category."""
    seeds: list[Trace] = []
    for tid in (cluster.example_trace_ids or [])[-n:]:
        t = db.get(Trace, tid)
        if t:
            seeds.append(t)
    if seeds:
        return seeds

    rows = db.execute(
        select(Trace)
        .where(
            Trace.agent_id == cluster.agent_id,
            Trace.failure_categories.any(cluster.name),
        )
        .order_by(Trace.timestamp.desc())
        .limit(n)
    ).scalars().all()
    return list(rows)


def generate_adversarial_batch(db: Session, cluster: FailureCluster) -> list[dict[str, Any]]:
    """Return generated_cases payload for a single AdversarialJob.

    Each case is shaped like:
        {
          "input": {...},
          "rubric": str,
          "difficulty": int (1..5),
          "strategy": str,
          "cluster_tag": cluster.name,
          "parent_case_id": str | None,    # eval_case lineage if known
          "parent_trace_id": str,          # always present
          "tag": str,                      # short hash key
        }
    """
    seeds = _select_seed_traces(db, cluster)
    out: list[dict[str, Any]] = []

    for trace in seeds:
        # Try to recover the originating eval case for lineage.
        parent_case_id = str(trace.eval_case_id) if trace.eval_case_id else None
        parent_case = db.get(EvalCase, trace.eval_case_id) if trace.eval_case_id else None
        rubric = parent_case.rubric if parent_case else (
            f"Output must address the same intent as parent trace {trace.id}, "
            f"while satisfying the cluster constraint: {cluster.name}."
        )
        expected_output = parent_case.expected_output if parent_case else None

        for variant in all_strategies(trace.input):
            out.append({
                "input": variant["input"],
                "expected_output": expected_output,
                "rubric": rubric,
                "difficulty": variant["difficulty"],
                "strategy": variant["strategy"],
                "cluster_tag": cluster.name,
                "parent_case_id": parent_case_id,
                "parent_trace_id": str(trace.id),
                "tag": variant["tag"],
            })

    # Cap to keep review queues sane (the prompt mentions ~15 in the demo).
    return out[:60]


def promote_to_golden_if_caught_regression(db: Session, eval_case_id) -> None:
    """When an adversarial case catches a regression in a deploy gate run,
    promote it to golden=True so it is never auto-removed from the corpus.

    Called from the gate worker. Idempotent.
    """
    case = db.get(EvalCase, eval_case_id)
    if not case or case.golden:
        return
    if case.generation_method == "adversarial":
        case.golden = True
        db.flush()
