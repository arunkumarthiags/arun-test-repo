"""Scorer engine — orchestrates deterministic + semantic scorers per trace.

Writes:
  - trace.scores  (JSONB rollup, fast read)
  - score_lineage (append-only audit log, full inputs + reasoning)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import EvalCase, ScoreLineage, Trace
from . import deterministic as det
from .semantic import judge


# Default scorer config for an agent. Production should pull this from a
# per-agent settings table; for now we ship sensible defaults.
DEFAULT_AGENT_CONFIG: dict[str, Any] = {
    "required_fields": ["title", "acceptance_criteria"],
    "expected_tools": [],
    "token_budget": 4000,
    "latency_slo_ms": 8000,
    "forbidden_patterns": [r"\bAS AN AI\b", r"\bI cannot\b"],
    "semantic_scorers": [
        "compliance_language",
        "reasoning_coherence",
        "task_completion",
    ],
    "pass_threshold": 0.7,
}


def score_trace(db: Session, trace: Trace) -> dict[str, Any]:
    """Score a trace. Returns the scores dict (also persisted onto trace.scores)."""
    settings = get_settings()
    cfg = DEFAULT_AGENT_CONFIG  # TODO: per-agent overrides keyed by trace.agent_id

    # Pull rubric/sources from associated eval case if any.
    rubric: str = ""
    sources: list[str] = []
    if trace.eval_case_id:
        case = db.get(EvalCase, trace.eval_case_id)
        if case:
            rubric = case.rubric or ""
            if isinstance(case.input, dict):
                sources = list(case.input.get("sources") or [])

    scores: dict[str, dict[str, Any]] = {}

    # ── Deterministic scorers ──────────────────────────────────────────────
    s, why, payload = det.schema_validation(trace.output, cfg["required_fields"])
    _record_lineage(db, trace, "schema_validation", "deterministic", s, payload, why)
    scores["schema_validation"] = {"score": s, "reasoning": why}

    s, why, payload = det.tool_call_correctness(trace.steps or [], cfg["expected_tools"])
    _record_lineage(db, trace, "tool_call_correctness", "deterministic", s, payload, why)
    scores["tool_call_correctness"] = {"score": s, "reasoning": why}

    s, why, payload = det.token_budget_adherence(trace.total_tokens or 0, cfg["token_budget"])
    _record_lineage(db, trace, "token_budget", "deterministic", s, payload, why)
    scores["token_budget"] = {"score": s, "reasoning": why}

    s, why, payload = det.latency_slo(trace.latency_ms or 0, cfg["latency_slo_ms"])
    _record_lineage(db, trace, "latency_slo", "deterministic", s, payload, why)
    scores["latency_slo"] = {"score": s, "reasoning": why}

    s, why, payload = det.output_format_check(trace.output, cfg["forbidden_patterns"])
    _record_lineage(db, trace, "output_format", "deterministic", s, payload, why)
    scores["output_format"] = {"score": s, "reasoning": why}

    # ── Semantic scorers (LLM-as-judge) ────────────────────────────────────
    judge_payload = {
        "input": trace.input,
        "output": trace.output,
        "steps": trace.steps,
        "rubric": rubric,
        "sources": sources,
    }
    for scorer_name in cfg["semantic_scorers"]:
        j = judge(scorer_name, judge_payload, judge_model=settings.judge_model)
        _record_lineage(
            db, trace, scorer_name, "semantic", j.score,
            j.input_payload, j.reasoning,
            confidence=j.confidence,
            judge_model=j.judge_model,
            prompt_hash=j.prompt_hash,
        )
        scores[scorer_name] = {
            "score": j.score,
            "confidence": j.confidence,
            "reasoning": j.reasoning,
            "judge_model": j.judge_model,
        }

    # Rollup
    all_scores = [v["score"] for v in scores.values()]
    overall = sum(all_scores) / len(all_scores) if all_scores else 0.0
    passed = overall >= cfg["pass_threshold"]
    scores["__rollup__"] = {
        "overall_score": round(overall, 3),
        "passed": passed,
        "pass_threshold": cfg["pass_threshold"],
        "scored_at": datetime.now(timezone.utc).isoformat(),
    }

    trace.scores = scores
    return {
        "overall_pass_rate": 1.0 if passed else 0.0,
        "overall_score": overall,
        "passed": passed,
        "scores": scores,
    }


def _record_lineage(
    db: Session,
    trace: Trace,
    scorer_name: str,
    scorer_kind: str,
    score: float,
    input_payload: dict[str, Any],
    reasoning: str,
    *,
    confidence: float | None = None,
    judge_model: str | None = None,
    prompt_hash: str | None = None,
) -> None:
    db.add(ScoreLineage(
        trace_id=trace.id,
        scorer_name=scorer_name,
        scorer_kind=scorer_kind,
        score=float(score),
        confidence=confidence,
        judge_model=judge_model,
        judge_prompt_hash=prompt_hash,
        input_payload=input_payload,
        reasoning=reasoning,
    ))
