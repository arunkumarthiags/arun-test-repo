"""SQLAlchemy models — the data spec from the build prompt, implemented exactly."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


SourceLiteral = Literal["eval", "production", "synthetic"]
GenerationMethod = Literal["human", "adversarial", "promoted_from_production"]
JobStatus = Literal["pending", "running", "review", "approved", "rejected"]


class Trace(Base):
    """One agent invocation — full reasoning tree captured."""
    __tablename__ = "traces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    input: Mapped[dict] = mapped_column(JSONB, nullable=False)
    output: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)

    scores: Mapped[dict] = mapped_column(JSONB, default=dict)
    failure_categories: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    source: Mapped[str] = mapped_column(String(32), default="production")

    eval_case_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("eval_cases.id", ondelete="SET NULL"), nullable=True, index=True
    )

    __table_args__ = (
        Index("ix_traces_agent_version", "agent_id", "version"),
        Index("ix_traces_agent_source_ts", "agent_id", "source", "timestamp"),
    )


class EvalCase(Base):
    """One entry in the hardened corpus."""
    __tablename__ = "eval_cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    input: Mapped[dict] = mapped_column(JSONB, nullable=False)
    expected_output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rubric: Mapped[str] = mapped_column(Text, nullable=False, default="")

    difficulty: Mapped[int] = mapped_column(Integer, default=3)
    cluster_tag: Mapped[str] = mapped_column(String(128), default="uncategorized", index=True)

    generation_method: Mapped[str] = mapped_column(String(32), default="human")
    parent_case_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("eval_cases.id", ondelete="SET NULL"), nullable=True
    )

    golden: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pass_rate_30d: Mapped[float | None] = mapped_column(Float, nullable=True)


class RunResult(Base):
    """Outcome of one gate run against one eval case."""
    __tablename__ = "run_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    eval_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("eval_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    trace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traces.id", ondelete="SET NULL"), nullable=True
    )
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    scores: Mapped[dict] = mapped_column(JSONB, default=dict)
    regression: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_run_results_version_passed", "agent_version", "passed"),)


class FailureCluster(Base):
    """A named category of failure modes; feeds the adversarial generator."""
    __tablename__ = "failure_clusters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")

    count_7d: Mapped[int] = mapped_column(Integer, default=0)
    count_30d: Mapped[int] = mapped_column(Integer, default=0)

    example_trace_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    adversarial_queue_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (Index("ix_clusters_agent_name", "agent_id", "name", unique=True),)


class AdversarialJob(Base):
    """Tracks one batch of generated adversarial cases."""
    __tablename__ = "adversarial_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("failure_clusters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    generated_cases: Mapped[list] = mapped_column(JSONB, default=list)
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ScoreLineage(Base):
    """Append-only audit log for every semantic judgment.

    The compliance team must be able to reconstruct any decision. Black-box
    judgments are not allowed — every row records full input + reasoning.
    """
    __tablename__ = "score_lineage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    trace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scorer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    scorer_kind: Mapped[str] = mapped_column(String(32), nullable=False)  # 'deterministic' | 'semantic'
    score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    judge_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    judge_prompt_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    input_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GateRun(Base):
    """Cached deploy-gate result. Determinism: keyed by (agent, corpus_hash, version)."""
    __tablename__ = "gate_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    agent_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    corpus_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    pass_rate: Mapped[float] = mapped_column(Float, nullable=False)
    regressions: Mapped[list] = mapped_column(JSONB, default=list)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    cost_delta_usd: Mapped[float] = mapped_column(Float, default=0.0)
    latency_p50_ms: Mapped[int] = mapped_column(Integer, default=0)
    latency_delta_ms: Mapped[int] = mapped_column(Integer, default=0)

    report: Mapped[dict] = mapped_column(JSONB, default=dict)
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index(
            "ix_gate_runs_cache_key",
            "agent_id", "agent_version", "corpus_hash",
            unique=True,
        ),
    )


class ClassifierSeed(Base):
    """Embedding seed examples per failure category. pgvector lookup, <50ms target."""
    __tablename__ = "classifier_seeds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # Stored as JSONB for portability; production deployment should use pgvector's vector type.
    embedding: Mapped[list[float]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DriftSample(Base):
    """Production traces sampled at drift_sample_rate, scored against eval baseline."""
    __tablename__ = "drift_samples"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    trace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False
    )
    pass_rate_window_7d: Mapped[float | None] = mapped_column(Float, nullable=True)
    eval_pass_rate_baseline: Mapped[float | None] = mapped_column(Float, nullable=True)
    delta_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    alert_fired: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
