from gauntlet_api.scorers import deterministic as det


def test_schema_validation_pass():
    s, _, _ = det.schema_validation({"title": "X", "acceptance_criteria": []}, ["title", "acceptance_criteria"])
    assert s == 1.0


def test_schema_validation_missing():
    s, _, payload = det.schema_validation({"title": "X"}, ["title", "acceptance_criteria"])
    assert s == 0.0
    assert "acceptance_criteria" in payload["missing"]


def test_token_budget_within():
    s, _, _ = det.token_budget_adherence(800, 1000)
    assert s == 1.0


def test_token_budget_over():
    s, _, _ = det.token_budget_adherence(2000, 1000)
    assert 0.0 <= s < 1.0


def test_latency_slo_violation():
    s, _, _ = det.latency_slo(15000, 5000)
    assert s == 0.0


def test_output_format_forbidden_pattern():
    s, _, _ = det.output_format_check({"text": "AS AN AI I cannot help"}, [r"\bAS AN AI\b"])
    assert s == 0.0


def test_tool_call_correctness_in_order():
    steps = [
        {"kind": "tool_call", "name": "search_docs"},
        {"kind": "reasoning"},
        {"kind": "tool_call", "name": "summarize"},
    ]
    s, _, _ = det.tool_call_correctness(steps, ["search", "summarize"])
    assert s == 1.0


def test_tool_call_correctness_out_of_order():
    steps = [
        {"kind": "tool_call", "name": "summarize"},
        {"kind": "tool_call", "name": "search_docs"},
    ]
    s, _, _ = det.tool_call_correctness(steps, ["search", "summarize"])
    # First expected wasn't matched until index 1; second never matched after.
    assert s < 1.0
