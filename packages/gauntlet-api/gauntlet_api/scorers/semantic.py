"""Semantic scorers — LLM-as-judge.

Every judgment logs full lineage. The judge model is configurable per-agent so
enterprises can plug in their own.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from typing import Any


JUDGE_PROMPTS: dict[str, str] = {
    "factual_consistency": (
        "You are a strict eval judge. Compare the agent's output against the "
        "source documents in the input. Score 0.0–1.0 for factual consistency. "
        "Return JSON: {score, confidence, reasoning}."
    ),
    "compliance_language": (
        "You are a compliance reviewer. The agent must use compliant language "
        "for the regulatory context implied by the input (e.g. EU/UK/US, "
        "regulated domain). Score 0.0–1.0. Return JSON: {score, confidence, reasoning}."
    ),
    "reasoning_coherence": (
        "Inspect the agent's intermediate reasoning steps. Score 0.0–1.0 for "
        "logical coherence and absence of contradiction. "
        "Return JSON: {score, confidence, reasoning}."
    ),
    "task_completion": (
        "Judge how completely the agent's output satisfies the rubric. "
        "Score 0.0–1.0. Return JSON: {score, confidence, reasoning}."
    ),
}


@dataclass
class SemanticJudgment:
    score: float
    confidence: float
    reasoning: str
    judge_model: str
    prompt_hash: str
    input_payload: dict[str, Any]


def _prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]


def _heuristic_judge(scorer_name: str, payload: dict[str, Any]) -> SemanticJudgment:
    """Deterministic offline heuristic used when no API key is configured.

    Keeps demos and tests reproducible. Real deployments configure an API key
    and the path below in `_anthropic_judge` is taken instead.
    """
    output_blob = json.dumps(payload.get("output", {}), sort_keys=True).lower()
    rubric = (payload.get("rubric") or "").lower()
    score = 1.0
    reasoning_parts: list[str] = []

    if scorer_name == "compliance_language":
        # Heuristic: compliance failures mention "guarantee", "risk-free", "always", "never"
        forbidden = ["guarantee", "risk-free", "always", "never fails", "100% safe"]
        hits = [w for w in forbidden if w in output_blob]
        if hits:
            score = max(0.0, 1.0 - 0.3 * len(hits))
            reasoning_parts.append(f"forbidden language: {hits}")
        else:
            reasoning_parts.append("no forbidden compliance language detected")

    elif scorer_name == "factual_consistency":
        sources = payload.get("sources") or []
        if sources:
            present = sum(1 for s in sources if str(s).lower()[:20] in output_blob)
            score = present / max(1, len(sources))
            reasoning_parts.append(f"{present}/{len(sources)} sources echoed")
        else:
            reasoning_parts.append("no source documents to verify against")

    elif scorer_name == "reasoning_coherence":
        steps = payload.get("steps", [])
        score = 1.0 if len(steps) >= 2 else 0.5
        reasoning_parts.append(f"steps={len(steps)}")

    elif scorer_name == "task_completion":
        if rubric:
            tokens = [t for t in re.findall(r"[a-z]{4,}", rubric)][:8]
            present = sum(1 for t in tokens if t in output_blob)
            score = present / max(1, len(tokens))
            reasoning_parts.append(f"rubric coverage: {present}/{len(tokens)} key tokens present")
        else:
            score = 0.7
            reasoning_parts.append("no rubric — defaulting to neutral pass")

    return SemanticJudgment(
        score=round(score, 3),
        confidence=0.6,
        reasoning="; ".join(reasoning_parts) or "n/a",
        judge_model="heuristic-offline-v1",
        prompt_hash=_prompt_hash(JUDGE_PROMPTS.get(scorer_name, scorer_name)),
        input_payload=payload,
    )


def _anthropic_judge(
    scorer_name: str, payload: dict[str, Any], judge_model: str
) -> SemanticJudgment:
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    prompt = JUDGE_PROMPTS[scorer_name]
    user_blob = json.dumps(payload, sort_keys=True, default=str)[:8000]

    msg = client.messages.create(
        model=judge_model,
        max_tokens=400,
        system=prompt,
        messages=[{"role": "user", "content": user_blob}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
    try:
        parsed = json.loads(text[text.index("{"): text.rindex("}") + 1])
        score = float(parsed.get("score", 0.0))
        confidence = float(parsed.get("confidence", 0.7))
        reasoning = str(parsed.get("reasoning", ""))
    except Exception:
        score, confidence, reasoning = 0.5, 0.3, f"parse-failure: {text[:200]}"

    return SemanticJudgment(
        score=score,
        confidence=confidence,
        reasoning=reasoning,
        judge_model=judge_model,
        prompt_hash=_prompt_hash(prompt),
        input_payload=payload,
    )


def judge(
    scorer_name: str,
    payload: dict[str, Any],
    judge_model: str,
) -> SemanticJudgment:
    """Single semantic-scorer entrypoint. Switches to the offline heuristic when
    no API key is set so the rest of the system is fully runnable in dev/CI."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return _anthropic_judge(scorer_name, payload, judge_model)
        except Exception as e:  # network/quota errors must not crash scoring
            j = _heuristic_judge(scorer_name, payload)
            j.reasoning = f"[fallback after judge error: {e}] {j.reasoning}"
            return j
    return _heuristic_judge(scorer_name, payload)
