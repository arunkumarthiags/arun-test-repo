"""Pydantic API schemas. These are the wire formats — the SDK and clients
serialize against these models."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class StepIn(BaseModel):
    kind: Literal["reasoning", "tool_call", "tool_result", "completion"]
    name: str | None = None
    input: dict[str, Any] | None = None
    output: dict[str, Any] | str | None = None
    tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0


class TraceIn(BaseModel):
    agent_id: str
    version: str = "unknown"
    input: dict[str, Any]
    output: dict[str, Any] = Field(default_factory=dict)
    steps: list[StepIn] = Field(default_factory=list)
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    latency_ms: int = 0
    source: Literal["eval", "production", "synthetic"] = "production"
    eval_case_id: uuid.UUID | None = None


class TraceOut(BaseModel):
    id: uuid.UUID
    agent_id: str
    version: str
    timestamp: datetime
    input: dict[str, Any]
    output: dict[str, Any]
    steps: list[dict[str, Any]]
    total_tokens: int
    total_cost_usd: float
    latency_ms: int
    scores: dict[str, Any]
    failure_categories: list[str]
    source: str
    eval_case_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class EvalCaseIn(BaseModel):
    agent_id: str
    input: dict[str, Any]
    expected_output: dict[str, Any] | None = None
    rubric: str = ""
    difficulty: int = 3
    cluster_tag: str = "uncategorized"
    generation_method: Literal["human", "adversarial", "promoted_from_production"] = "human"
    parent_case_id: uuid.UUID | None = None
    golden: bool = False


class EvalCaseOut(EvalCaseIn):
    id: uuid.UUID
    created_at: datetime
    last_run_at: datetime | None
    pass_rate_30d: float | None

    model_config = {"from_attributes": True}


class ClusterOut(BaseModel):
    id: uuid.UUID
    agent_id: str
    name: str
    description: str
    count_7d: int
    count_30d: int
    example_trace_ids: list[uuid.UUID]
    adversarial_queue_triggered_at: datetime | None

    model_config = {"from_attributes": True}


class AdversarialJobOut(BaseModel):
    id: uuid.UUID
    cluster_id: uuid.UUID
    status: str
    generated_cases: list[dict[str, Any]]
    reviewer_notes: str | None
    created_at: datetime
    approved_at: datetime | None

    model_config = {"from_attributes": True}


class GateRequest(BaseModel):
    agent_id: str
    agent_version: str
    fail_on_regression: bool = True
    concurrency: int = 8


class GateRegressionEntry(BaseModel):
    eval_case_id: uuid.UUID
    cluster_tag: str
    previous_pass: bool
    current_pass: bool
    rubric_summary: str


class GateReport(BaseModel):
    agent_id: str
    agent_version: str
    corpus_hash: str
    pass_rate: float
    n_cases: int
    n_regressions: int
    regressions: list[GateRegressionEntry]
    coverage_gaps: dict[str, int]   # cluster_tag -> count of new cases not yet run
    cost_usd: float
    cost_delta_usd: float
    latency_p50_ms: int
    latency_delta_ms: int
    cached: bool
    exit_code: int


class DriftReport(BaseModel):
    agent_id: str
    eval_pass_rate: float
    prod_pass_rate_7d: float
    delta_pct: float
    threshold_pct: float
    top_failing_cluster: str | None
    alert_fired: bool
