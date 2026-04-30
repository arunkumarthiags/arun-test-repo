"""Adversarial generator — all 4 strategies, lineage, deterministic."""
from gauntlet_api.adversarial.strategies import (
    all_strategies,
    complexity_escalation,
    edge_case_injection,
    persona_variation,
    semantic_paraphrase,
)


SEED = {"request": "Build a savings widget that always beats the market for our UK customers."}


def test_paraphrase_produces_multiple_distinct_variants():
    out = semantic_paraphrase(SEED)
    assert len(out) >= 5
    texts = {v["input"]["request"] for v in out}
    assert len(texts) >= 4


def test_persona_variation_covers_all_personas():
    out = persona_variation(SEED)
    personas = {v["input"]["persona"] for v in out}
    assert {"power_user", "new_user", "adversarial_user", "non_native_speaker", "domain_expert"} <= personas


def test_edge_case_injection_adds_constraints():
    out = edge_case_injection(SEED)
    assert all("constraints" in v["input"] for v in out)
    assert any(v["input"]["context_flag"] == "regulated" for v in out)


def test_complexity_escalation_adds_nested_requirements():
    out = complexity_escalation(SEED)
    assert all("nested_requirements" in v["input"] and len(v["input"]["nested_requirements"]) >= 1 for v in out)
    assert all(v["difficulty"] == 5 for v in out)


def test_all_strategies_yields_all_four_kinds():
    kinds = {v["strategy"] for v in all_strategies(SEED)}
    assert kinds == {"semantic_paraphrase", "persona_variation", "edge_case_injection", "complexity_escalation"}


def test_variants_carry_required_lineage_fields():
    for v in all_strategies(SEED):
        assert "strategy" in v
        assert isinstance(v["difficulty"], int) and 1 <= v["difficulty"] <= 5
        assert "tag" in v
