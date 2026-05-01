from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import GateRun

router = APIRouter(prefix="/v1/runs", tags=["runs"])


@router.get("")
def list_runs(
    db: Annotated[Session, Depends(get_db)],
    agent_id: str | None = None,
    limit: int = Query(default=50, le=500),
) -> list[dict]:
    q = select(GateRun).order_by(GateRun.created_at.desc()).limit(limit)
    if agent_id:
        q = q.where(GateRun.agent_id == agent_id)
    rows = db.execute(q).scalars().all()
    return [
        {
            "id": str(r.id),
            "agent_id": r.agent_id,
            "agent_version": r.agent_version,
            "corpus_hash": r.corpus_hash,
            "pass_rate": r.pass_rate,
            "n_regressions": len(r.regressions or []),
            "cost_usd": r.cost_usd,
            "cost_delta_usd": r.cost_delta_usd,
            "latency_p50_ms": r.latency_p50_ms,
            "latency_delta_ms": r.latency_delta_ms,
            "cached": r.cached,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
