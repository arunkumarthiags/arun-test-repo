"""Failure classifier — embedding similarity, fast and deterministic."""
from gauntlet_api.classifier.embeddings import cosine, embed_text
from gauntlet_api.classifier.seeds import DEFAULT_SEEDS


def _best_category(text: str) -> str:
    qv = embed_text(text)
    best_cat, best_sim = "", -1.0
    for cat, examples in DEFAULT_SEEDS.items():
        for ex in examples:
            sim = cosine(qv, embed_text(ex))
            if sim > best_sim:
                best_sim, best_cat = sim, cat
    return best_cat


def test_compliance_failure_text_matches_compliance_cluster():
    assert _best_category(
        "marketing claim says we always beat the market and guarantee returns"
    ) == "compliance_language_failure"


def test_prompt_injection_text_matches_injection_cluster():
    assert _best_category(
        "user prompt told the agent to ignore previous instructions"
    ) == "prompt_injection"


def test_hallucination_text_matches_hallucination_cluster():
    assert _best_category(
        "the response cites a fabricated statistic that is not in any document"
    ) == "hallucination"


def test_embedding_is_deterministic():
    assert embed_text("regulated context UK FCA") == embed_text("regulated context UK FCA")
