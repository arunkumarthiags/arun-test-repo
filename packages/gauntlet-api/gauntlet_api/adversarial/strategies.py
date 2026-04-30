"""Four adversarial generation strategies.

Each strategy takes a failing input dict and returns a list of variants.
Each variant carries a difficulty score and a strategy tag for full lineage.
Implementations are intentionally deterministic so the demo, tests, and the
review queue produce reproducible cases. Plug in an LLM for the production
generator by replacing `_paraphrase` / `_persona` etc. — interface unchanged.
"""
from __future__ import annotations

import copy
import hashlib
import re
from typing import Any, Iterable

PERSONAS = [
    "power_user",
    "new_user",
    "adversarial_user",
    "non_native_speaker",
    "domain_expert",
]

EDGE_CASES = [
    {"context": "regulated", "constraint": "must comply with EU MiFID II disclosure requirements"},
    {"context": "international", "constraint": "user is in the UK; assume FCA conduct rules apply"},
    {"context": "ambiguous", "constraint": "the requirement is deliberately under-specified"},
    {"context": "conflicting", "constraint": "two acceptance criteria contradict each other"},
    {"context": "regulated", "constraint": "feature is in the HIPAA-covered health-data path"},
]

COMPLEXITY_LAYERS = [
    "add a nested precondition: feature only applies when the user has completed onboarding",
    "introduce a multi-step dependency: persistence must roll back if downstream notify fails",
    "add a contradictory sub-goal: maximize speed AND maximize human review coverage",
]


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]


def _paraphrases(text: str, n: int = 10) -> list[str]:
    """Surface-form rewrites preserving intent. The deterministic stub uses
    rule-based transformations; production swaps in an LLM call."""
    base = text.strip()
    forms: list[str] = []
    rules: list[tuple[str, str]] = [
        (r"\bI need\b", "Please build"),
        (r"\bcan you\b", "could you"),
        (r"\bhelp me\b", "assist with"),
        (r"\buser\b", "customer"),
        (r"\bfeature\b", "capability"),
        (r"\bsystem\b", "platform"),
    ]
    forms.append(base)  # original
    for k in range(1, n):
        out = base
        for pat, repl in rules:
            if k % 2:
                out = re.sub(pat, repl, out, flags=re.IGNORECASE)
        prefix = ["", "Hi! ", "Quick ask: ", "TL;DR — ", "Context first: ", "As discussed, "][k % 6]
        suffix = ["", " Thanks.", " Please prioritize.", " (urgent)", " — by EOW.", ""][k % 6]
        forms.append(f"{prefix}{out}{suffix}")
    # Dedupe while preserving order.
    seen: set[str] = set()
    deduped: list[str] = []
    for f in forms:
        if f not in seen:
            seen.add(f)
            deduped.append(f)
    return deduped[:n]


def semantic_paraphrase(failing: dict) -> list[dict]:
    base_text = failing.get("description") or failing.get("request") or str(failing)
    variants: list[dict] = []
    for i, t in enumerate(_paraphrases(base_text, n=10)):
        v = copy.deepcopy(failing)
        if "description" in v:
            v["description"] = t
        elif "request" in v:
            v["request"] = t
        else:
            v["description"] = t
        variants.append({
            "input": v,
            "strategy": "semantic_paraphrase",
            "difficulty": 2 if i < 3 else 3,
            "tag": f"para#{i}-{_hash(t)}",
        })
    return variants


def persona_variation(failing: dict) -> list[dict]:
    variants: list[dict] = []
    for persona in PERSONAS:
        v = copy.deepcopy(failing)
        v["persona"] = persona
        difficulty = {"power_user": 3, "new_user": 2, "adversarial_user": 5, "non_native_speaker": 4, "domain_expert": 4}[persona]
        variants.append({
            "input": v,
            "strategy": "persona_variation",
            "difficulty": difficulty,
            "tag": f"persona-{persona}",
        })
    return variants


def edge_case_injection(failing: dict) -> list[dict]:
    variants: list[dict] = []
    for ec in EDGE_CASES:
        v = copy.deepcopy(failing)
        v.setdefault("constraints", []).append(ec["constraint"])
        v["context_flag"] = ec["context"]
        variants.append({
            "input": v,
            "strategy": "edge_case_injection",
            "difficulty": 4 if ec["context"] in {"regulated", "conflicting"} else 3,
            "tag": f"edge-{ec['context']}",
        })
    return variants


def complexity_escalation(failing: dict) -> list[dict]:
    variants: list[dict] = []
    for layer in COMPLEXITY_LAYERS:
        v = copy.deepcopy(failing)
        v.setdefault("nested_requirements", []).append(layer)
        variants.append({
            "input": v,
            "strategy": "complexity_escalation",
            "difficulty": 5,
            "tag": f"complex-{_hash(layer)}",
        })
    return variants


def all_strategies(failing: dict) -> Iterable[dict]:
    yield from semantic_paraphrase(failing)
    yield from persona_variation(failing)
    yield from edge_case_injection(failing)
    yield from complexity_escalation(failing)
