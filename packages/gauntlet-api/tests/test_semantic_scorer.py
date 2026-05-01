"""LLM-as-judge tests — the offline heuristic path is exercised; the network
path is mocked out by simply not setting ANTHROPIC_API_KEY."""
import os

from gauntlet_api.scorers.semantic import judge


def test_compliance_language_flags_forbidden_words():
    os.environ.pop("ANTHROPIC_API_KEY", None)
    j = judge("compliance_language", {
        "input": {"request": "marketing copy"},
        "output": {"text": "We guarantee a risk-free always-on platform"},
    }, judge_model="heuristic-offline-v1")
    assert j.score < 0.7
    assert "forbidden" in j.reasoning.lower()
    assert j.judge_model
    assert j.prompt_hash


def test_compliance_language_passes_clean_output():
    os.environ.pop("ANTHROPIC_API_KEY", None)
    j = judge("compliance_language", {
        "output": {"text": "Provides X, subject to applicable regulatory disclosures."}
    }, judge_model="heuristic-offline-v1")
    assert j.score == 1.0


def test_judge_emits_full_lineage():
    j = judge("task_completion", {"output": {"x": 1}, "rubric": "produce widgets"}, judge_model="m")
    # Every judgment must have these audit fields populated.
    assert j.judge_model and j.prompt_hash and j.input_payload and j.reasoning is not None
    assert 0.0 <= j.score <= 1.0
    assert 0.0 <= j.confidence <= 1.0
