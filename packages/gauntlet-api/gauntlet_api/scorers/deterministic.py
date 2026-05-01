"""Deterministic scorers — pure Python, zero non-determinism, fully auditable.

Each function returns (score: float in [0,1], reasoning: str, payload: dict).
"""
from __future__ import annotations

import re
from typing import Any


def schema_validation(output: dict[str, Any], required_fields: list[str]) -> tuple[float, str, dict]:
    if not isinstance(output, dict):
        return 0.0, "output is not a JSON object", {"required": required_fields}
    missing = [f for f in required_fields if f not in output]
    if missing:
        return 0.0, f"missing required fields: {missing}", {"missing": missing}
    return 1.0, "all required fields present", {"required": required_fields}


def tool_call_correctness(
    steps: list[dict], expected_tools: list[str] | None
) -> tuple[float, str, dict]:
    """Did the agent call the right tools in a valid order? `expected_tools` is
    a list of substrings that must appear, in order, among the tool_call steps."""
    called = [s.get("name", "") for s in steps if s.get("kind") == "tool_call"]
    if not expected_tools:
        return 1.0, "no expected tool sequence configured", {"called": called}
    i = 0
    for name in called:
        if i < len(expected_tools) and expected_tools[i] in name:
            i += 1
    if i == len(expected_tools):
        return 1.0, "all expected tools called in order", {"called": called, "expected": expected_tools}
    return i / len(expected_tools), f"matched {i}/{len(expected_tools)} expected tools", {
        "called": called, "expected": expected_tools, "matched": i,
    }


def token_budget_adherence(total_tokens: int, budget: int) -> tuple[float, str, dict]:
    if total_tokens <= budget:
        return 1.0, f"within budget ({total_tokens}/{budget})", {"tokens": total_tokens, "budget": budget}
    over_pct = (total_tokens - budget) / budget
    score = max(0.0, 1.0 - over_pct)
    return score, f"over budget by {over_pct:.0%}", {"tokens": total_tokens, "budget": budget}


def latency_slo(latency_ms: int, slo_ms: int) -> tuple[float, str, dict]:
    if latency_ms <= slo_ms:
        return 1.0, f"within SLO ({latency_ms}ms ≤ {slo_ms}ms)", {"latency_ms": latency_ms, "slo_ms": slo_ms}
    return 0.0, f"violated SLO ({latency_ms}ms > {slo_ms}ms)", {"latency_ms": latency_ms, "slo_ms": slo_ms}


def output_format_check(
    output: dict[str, Any], forbidden_patterns: list[str]
) -> tuple[float, str, dict]:
    blob = str(output)
    hits = [p for p in forbidden_patterns if re.search(p, blob, flags=re.IGNORECASE)]
    if hits:
        return 0.0, f"forbidden pattern(s) present: {hits}", {"hits": hits}
    return 1.0, "no forbidden patterns", {"forbidden": forbidden_patterns}
