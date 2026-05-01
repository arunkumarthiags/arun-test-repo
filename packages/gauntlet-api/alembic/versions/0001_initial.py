"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-30 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgvector extension is optional; embeddings are stored as JSONB.
    # op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "eval_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", sa.String(128), nullable=False, index=True),
        sa.Column("input", postgresql.JSONB, nullable=False),
        sa.Column("expected_output", postgresql.JSONB, nullable=True),
        sa.Column("rubric", sa.Text, nullable=False, server_default=""),
        sa.Column("difficulty", sa.Integer, server_default="3"),
        sa.Column("cluster_tag", sa.String(128), server_default="uncategorized", index=True),
        sa.Column("generation_method", sa.String(32), server_default="human"),
        sa.Column("parent_case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("eval_cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("golden", sa.Boolean, server_default=sa.text("false"), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pass_rate_30d", sa.Float, nullable=True),
    )

    op.create_table(
        "traces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", sa.String(128), nullable=False, index=True),
        sa.Column("version", sa.String(64), nullable=False, index=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("input", postgresql.JSONB, nullable=False),
        sa.Column("output", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("steps", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("total_tokens", sa.Integer, server_default="0"),
        sa.Column("total_cost_usd", sa.Float, server_default="0"),
        sa.Column("latency_ms", sa.Integer, server_default="0"),
        sa.Column("scores", postgresql.JSONB, server_default="{}"),
        sa.Column("failure_categories", postgresql.ARRAY(sa.String), server_default="{}"),
        sa.Column("source", sa.String(32), server_default="production"),
        sa.Column("eval_case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("eval_cases.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    op.create_index("ix_traces_agent_version", "traces", ["agent_id", "version"])
    op.create_index("ix_traces_agent_source_ts", "traces", ["agent_id", "source", "timestamp"])

    op.create_table(
        "run_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("eval_case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("eval_cases.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("agent_version", sa.String(64), nullable=False, index=True),
        sa.Column("trace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("traces.id", ondelete="SET NULL"), nullable=True),
        sa.Column("passed", sa.Boolean, nullable=False),
        sa.Column("scores", postgresql.JSONB, server_default="{}"),
        sa.Column("regression", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_run_results_version_passed", "run_results", ["agent_version", "passed"])

    op.create_table(
        "failure_clusters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", sa.String(128), nullable=False, index=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("count_7d", sa.Integer, server_default="0"),
        sa.Column("count_30d", sa.Integer, server_default="0"),
        sa.Column("example_trace_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), server_default="{}"),
        sa.Column("adversarial_queue_triggered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_clusters_agent_name", "failure_clusters", ["agent_id", "name"], unique=True)

    op.create_table(
        "adversarial_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("failure_clusters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String(32), server_default="pending", index=True),
        sa.Column("generated_cases", postgresql.JSONB, server_default="[]"),
        sa.Column("reviewer_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "score_lineage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("scorer_name", sa.String(128), nullable=False),
        sa.Column("scorer_kind", sa.String(32), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("judge_model", sa.String(128), nullable=True),
        sa.Column("judge_prompt_hash", sa.String(64), nullable=True),
        sa.Column("input_payload", postgresql.JSONB, server_default="{}"),
        sa.Column("reasoning", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "gate_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", sa.String(128), nullable=False, index=True),
        sa.Column("agent_version", sa.String(64), nullable=False, index=True),
        sa.Column("corpus_hash", sa.String(64), nullable=False, index=True),
        sa.Column("pass_rate", sa.Float, nullable=False),
        sa.Column("regressions", postgresql.JSONB, server_default="[]"),
        sa.Column("cost_usd", sa.Float, server_default="0"),
        sa.Column("cost_delta_usd", sa.Float, server_default="0"),
        sa.Column("latency_p50_ms", sa.Integer, server_default="0"),
        sa.Column("latency_delta_ms", sa.Integer, server_default="0"),
        sa.Column("report", postgresql.JSONB, server_default="{}"),
        sa.Column("cached", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_gate_runs_cache_key", "gate_runs",
        ["agent_id", "agent_version", "corpus_hash"], unique=True,
    )

    op.create_table(
        "classifier_seeds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("category", sa.String(128), nullable=False, index=True),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("embedding", postgresql.JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "drift_samples",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", sa.String(128), nullable=False, index=True),
        sa.Column("trace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("traces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pass_rate_window_7d", sa.Float, nullable=True),
        sa.Column("eval_pass_rate_baseline", sa.Float, nullable=True),
        sa.Column("delta_pct", sa.Float, nullable=True),
        sa.Column("alert_fired", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    for t in [
        "drift_samples", "classifier_seeds", "gate_runs", "score_lineage",
        "adversarial_jobs", "failure_clusters", "run_results", "traces", "eval_cases",
    ]:
        op.drop_table(t)
