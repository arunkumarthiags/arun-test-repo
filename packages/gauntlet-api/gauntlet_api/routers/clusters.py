from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import FailureCluster, Trace
from ..schemas import ClusterOut

router = APIRouter(prefix="/v1/clusters", tags=["clusters"])


@router.get("", response_model=list[ClusterOut])
def list_clusters(
    db: Annotated[Session, Depends(get_db)],
    agent_id: str | None = None,
) -> list[ClusterOut]:
    q = select(FailureCluster).order_by(FailureCluster.count_7d.desc())
    if agent_id:
        q = q.where(FailureCluster.agent_id == agent_id)
    return [ClusterOut.model_validate(c) for c in db.execute(q).scalars().all()]


@router.get("/distribution")
def distribution(
    db: Annotated[Session, Depends(get_db)],
    agent_id: str,
    window: int = Query(default=7, ge=1, le=90),
) -> dict:
    """Failure distribution over a window (in days)."""
    q = select(FailureCluster).where(FailureCluster.agent_id == agent_id)
    rows = db.execute(q).scalars().all()
    field = "count_7d" if window <= 7 else "count_30d"
    total = sum(getattr(c, field) for c in rows) or 1
    return {
        "agent_id": agent_id,
        "window_days": window,
        "total": total,
        "buckets": [
            {
                "name": c.name,
                "count": getattr(c, field),
                "share": getattr(c, field) / total,
            }
            for c in rows
        ],
    }


@router.post("", response_model=ClusterOut)
def create_cluster(
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
) -> ClusterOut:
    cluster = FailureCluster(
        agent_id=payload["agent_id"],
        name=payload["name"],
        description=payload.get("description", ""),
    )
    db.add(cluster)
    db.commit()
    db.refresh(cluster)
    return ClusterOut.model_validate(cluster)


@router.patch("/{cluster_id}", response_model=ClusterOut)
def rename_cluster(
    cluster_id: uuid.UUID,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
) -> ClusterOut:
    cluster = db.get(FailureCluster, cluster_id)
    if not cluster:
        raise HTTPException(404, "cluster not found")
    if "name" in payload:
        cluster.name = payload["name"]
    if "description" in payload:
        cluster.description = payload["description"]
    db.commit()
    db.refresh(cluster)
    return ClusterOut.model_validate(cluster)


@router.post("/{a_id}/merge/{b_id}", response_model=ClusterOut)
def merge_clusters(
    a_id: uuid.UUID,
    b_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
) -> ClusterOut:
    """Merge cluster b into a. b is deleted; b's examples & counts roll into a."""
    a = db.get(FailureCluster, a_id)
    b = db.get(FailureCluster, b_id)
    if not a or not b:
        raise HTTPException(404, "cluster not found")
    if a.agent_id != b.agent_id:
        raise HTTPException(409, "cannot merge clusters from different agents")

    a.count_7d += b.count_7d
    a.count_30d += b.count_30d
    examples = list(a.example_trace_ids or []) + list(b.example_trace_ids or [])
    a.example_trace_ids = list({eid: None for eid in examples}.keys())[-20:]

    # Rewrite traces' failure_categories: replace b.name with a.name.
    traces = db.execute(
        select(Trace).where(
            Trace.agent_id == a.agent_id,
            Trace.failure_categories.any(b.name),
        )
    ).scalars().all()
    for t in traces:
        cats = [a.name if c == b.name else c for c in (t.failure_categories or [])]
        t.failure_categories = list(dict.fromkeys(cats))

    db.delete(b)
    db.commit()
    db.refresh(a)
    return ClusterOut.model_validate(a)


@router.get("/{cluster_id}/examples")
def cluster_examples(
    cluster_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    cluster = db.get(FailureCluster, cluster_id)
    if not cluster:
        raise HTTPException(404, "cluster not found")
    traces = db.execute(
        select(Trace).where(Trace.id.in_(cluster.example_trace_ids or []))
    ).scalars().all()
    return {
        "cluster": ClusterOut.model_validate(cluster).model_dump(mode="json"),
        "traces": [
            {"id": str(t.id), "input": t.input, "output": t.output, "scores": t.scores}
            for t in traces
        ],
    }
