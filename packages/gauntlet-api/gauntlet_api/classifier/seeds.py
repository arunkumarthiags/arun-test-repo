"""Default seed corpus for the failure-mode classifier.

Each category has a handful of canonical descriptions. The classifier matches a
trace against every category and returns those above the similarity threshold.
"""

DEFAULT_SEEDS: dict[str, list[str]] = {
    "reasoning_failure": [
        "agent's reasoning steps contradict each other; conclusion does not follow from premises",
        "the chain of thought skips a required step and lands on an unjustified answer",
        "logical gap between intermediate analysis and final output",
    ],
    "tool_selection_error": [
        "agent called the wrong tool, or skipped a required tool entirely",
        "a search tool was needed but the agent answered from internal knowledge",
        "called a write API when read-only access was intended",
    ],
    "context_insufficiency": [
        "agent did not retrieve enough source documents before answering",
        "input lacked key context and the agent did not ask a clarifying question",
        "answer is generic because the agent had no specific source material",
    ],
    "compliance_language_failure": [
        "marketing claim says we always beat the market and guarantee returns",
        "output uses guarantee language not permitted in regulated context",
        "marketing promise of guaranteed outcomes violates compliance guidance",
        "absolute statement always wins or never fails for marketing claim",
        "claims always beats market with guaranteed risk free returns",
        "uk regulatory phrasing missing where required for marketing claim",
        "eu gdpr or mifid disclosures absent in financial marketing output",
    ],
    "prompt_injection": [
        "user input contains instructions overriding the system prompt",
        "agent followed a malicious instruction embedded in retrieved document",
        "ignore previous instructions style attack succeeded",
    ],
    "hallucination": [
        "output cites a source that does not exist in the input documents",
        "fabricated statistic or quote not present in any retrieved context",
        "made-up function name or api endpoint that the system does not have",
    ],
    "latency_violation": [
        "agent took too long to respond, exceeding the configured slo",
        "tool call timed out and retries pushed total latency past the threshold",
    ],
    "cost_overrun": [
        "trace consumed far more tokens than the configured budget",
        "expensive model used for a task that should have used a smaller model",
    ],
    # Demo-domain clusters used by seed data
    "international_context": [
        "the request implies non-us regulatory context but output assumes us defaults",
        "user is a uk or eu customer but agent uses us-only language",
    ],
    "regulatory_feature": [
        "feature must comply with hipaa pci or sox but agent omits required controls",
        "regulated domain feature missing audit trail or consent requirement",
    ],
    "ambiguous_requirement": [
        "input is ambiguous between two interpretations and agent picked the wrong one",
        "underspecified acceptance criteria; agent fabricated detail rather than asking",
    ],
    "nested_dependency": [
        "request has multi-step dependency the agent flattened incorrectly",
        "subtask depends on output of earlier subtask but agent ran them out of order",
    ],
}
