from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AdversarialJob, EvalCase, FailureCluster
from ..schemas import AdversarialJobOut, EvalCaseOut

router = APIRouter(prefix="/v1/adversarial", tags=["adversarial"])


@router.get("/jobs", response_model=list[AdversarialJobOut])
def list_jobs(
    db: Annotated[Session, Depends(get_db)],
    status: str | None = None,
) -> list[AdversarialJobOut]:
    q = select(AdversarialJob).order_by(AdversarialJob.created_at.desc())
    if status:
        q = q.where(AdversarialJob.status == status)
    return [AdversarialJobOut.model_validate(j) for j in db.execute(q).scalars().all()]


@router.get("/jobs/{job_id}", response_model=AdversarialJobOut)
def get_job(job_id: uuid.UUID, db: Annotated[Session, Depends(get_db)]) -> AdversarialJobOut:
    job = db.get(AdversarialJob, job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return AdversarialJobOut.model_validate(job)


@router.post("/jobs/{job_id}/decide")
def decide_job(
    job_id: uuid.UUID,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Reviewer per-case approve/reject. Approved cases enter the eval corpus.

    Payload: {"approvals": {"<case_idx>": true|false, ...}, "notes": "..."}
    """
    job = db.get(AdversarialJob, job_id)
    if not job:
        raise HTTPException(404, "job not found")

    approvals: dict = payload.get("approvals", {})
    notes: str | None = payload.get("notes")
    cluster = db.get(FailureCluster, job.cluster_id)
    if not cluster:
        raise HTTPException(409, "originating cluster missing")

    promoted: list[str] = []
    cases = list(job.generated_cases or [])
    for idx_str, approved in approvals.items():
        idx = int(idx_str)
        if idx < 0 or idx >= len(cases):
            continue
        gen = cases[idx]
        gen["approved"] = bool(approved)
        if approved:
            new_case = EvalCase(
                agent_id=cluster.agent_id,
                input=gen["input"],
                expected_output=gen.get("expected_output"),
                rubric=gen.get("rubric", ""),
                difficulty=gen.get("difficulty", 4),
                cluster_tag=cluster.name,
                generation_method="adversarial",
                parent_case_id=uuid.UUID(gen["parent_case_id"]) if gen.get("parent_case_id") else None,
            )
            db.add(new_case)
            db.flush()
            promoted.append(str(new_case.id))
            gen["promoted_eval_case_id"] = str(new_case.id)

    job.generated_cases = cases
    if notes:
        job.reviewer_notes = notes

    n_decided = len([1 for c in cases if "approved" in c])
    if n_decided == len(cases):
        any_approved = any(c.get("approved") for c in cases)
        job.status = "approved" if any_approved else "rejected"
        job.approved_at = datetime.now(timezone.utc)

    db.commit()
    return {"ok": True, "promoted_count": len(promoted), "promoted_eval_case_ids": promoted}


@router.get("/queue/by-cluster/{cluster_id}", response_model=list[AdversarialJobOut])
def queue_for_cluster(
    cluster_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
) -> list[AdversarialJobOut]:
    rows = db.execute(
        select(AdversarialJob)
        .where(AdversarialJob.cluster_id == cluster_id)
        .order_by(AdversarialJob.created_at.desc())
    ).scalars().all()
    return [AdversarialJobOut.model_validate(j) for j in rows]
