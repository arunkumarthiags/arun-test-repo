from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..drift.monitor import compute_drift_report
from ..models import DriftSample
from ..schemas import DriftReport

router = APIRouter(prefix="/v1/drift", tags=["drift"])


@router.get("/{agent_id}", response_model=DriftReport)
def get_drift(
    agent_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> DriftReport:
    return compute_drift_report(db, agent_id=agent_id)


@router.get("/{agent_id}/timeseries")
def drift_timeseries(
    agent_id: str,
    db: Annotated[Session, Depends(get_db)],
    days: int = 30,
) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.execute(
        select(DriftSample)
        .where(DriftSample.agent_id == agent_id, DriftSample.created_at >= cutoff)
        .order_by(DriftSample.created_at.asc())
    ).scalars().all()
    return {
        "agent_id": agent_id,
        "points": [
            {
                "ts": r.created_at.isoformat(),
                "prod_pass_rate_7d": r.pass_rate_window_7d,
                "eval_pass_rate": r.eval_pass_rate_baseline,
                "delta_pct": r.delta_pct,
                "alert": r.alert_fired,
            }
            for r in rows
        ],
    }
