from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Trace
from ..schemas import TraceIn, TraceOut

router = APIRouter(prefix="/v1/traces", tags=["traces"])


@router.post("", response_model=TraceOut)
def ingest_trace(
    payload: TraceIn,
    db: Annotated[Session, Depends(get_db)],
) -> TraceOut:
    trace = Trace(
        agent_id=payload.agent_id,
        version=payload.version,
        input=payload.input,
        output=payload.output,
        steps=[s.model_dump() for s in payload.steps],
        total_tokens=payload.total_tokens,
        total_cost_usd=payload.total_cost_usd,
        latency_ms=payload.latency_ms,
        source=payload.source,
        eval_case_id=payload.eval_case_id,
    )
    db.add(trace)
    db.commit()
    db.refresh(trace)

    # Enqueue async scoring. Import inside to avoid Celery circular imports at startup.
    try:
        from ..workers.tasks import score_trace_task
        score_trace_task.delay(str(trace.id))
        # In Celery eager mode (used by tests) the task ran in-process on its own
        # session and committed; pull the updated row into our session.
        db.refresh(trace)
    except Exception:
        # If broker is unreachable, score inline as a fallback so the API still
        # returns a fully-scored trace for dev / disconnected workflows.
        from ..scorers.engine import score_trace
        score_trace(db, trace)
        db.commit()
        db.refresh(trace)

    return TraceOut.model_validate(trace)


@router.get("", response_model=list[TraceOut])
def list_traces(
    db: Annotated[Session, Depends(get_db)],
    agent_id: str | None = None,
    source: str | None = None,
    limit: int = Query(default=100, le=500),
) -> list[TraceOut]:
    q = select(Trace).order_by(Trace.timestamp.desc()).limit(limit)
    if agent_id:
        q = q.where(Trace.agent_id == agent_id)
    if source:
        q = q.where(Trace.source == source)
    rows = db.execute(q).scalars().all()
    return [TraceOut.model_validate(r) for r in rows]


@router.get("/{trace_id}", response_model=TraceOut)
def get_trace(
    trace_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
) -> TraceOut:
    t = db.get(Trace, trace_id)
    if not t:
        raise HTTPException(404, "trace not found")
    return TraceOut.model_validate(t)
