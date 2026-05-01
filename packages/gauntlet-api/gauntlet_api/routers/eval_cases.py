from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import EvalCase
from ..schemas import EvalCaseIn, EvalCaseOut

router = APIRouter(prefix="/v1/eval-cases", tags=["eval-cases"])


@router.post("", response_model=EvalCaseOut)
def create_case(
    payload: EvalCaseIn,
    db: Annotated[Session, Depends(get_db)],
) -> EvalCaseOut:
    case = EvalCase(**payload.model_dump())
    db.add(case)
    db.commit()
    db.refresh(case)
    return EvalCaseOut.model_validate(case)


@router.get("", response_model=list[EvalCaseOut])
def list_cases(
    db: Annotated[Session, Depends(get_db)],
    agent_id: str | None = None,
    cluster_tag: str | None = None,
    generation_method: str | None = None,
    golden: bool | None = None,
    difficulty: int | None = None,
    limit: int = Query(default=200, le=1000),
) -> list[EvalCaseOut]:
    q = select(EvalCase).order_by(EvalCase.created_at.desc()).limit(limit)
    if agent_id:
        q = q.where(EvalCase.agent_id == agent_id)
    if cluster_tag:
        q = q.where(EvalCase.cluster_tag == cluster_tag)
    if generation_method:
        q = q.where(EvalCase.generation_method == generation_method)
    if golden is not None:
        q = q.where(EvalCase.golden == golden)
    if difficulty:
        q = q.where(EvalCase.difficulty == difficulty)
    rows = db.execute(q).scalars().all()
    return [EvalCaseOut.model_validate(r) for r in rows]


@router.get("/{case_id}", response_model=EvalCaseOut)
def get_case(case_id: uuid.UUID, db: Annotated[Session, Depends(get_db)]) -> EvalCaseOut:
    case = db.get(EvalCase, case_id)
    if not case:
        raise HTTPException(404, "case not found")
    return EvalCaseOut.model_validate(case)


@router.patch("/{case_id}", response_model=EvalCaseOut)
def update_case(
    case_id: uuid.UUID,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
) -> EvalCaseOut:
    case = db.get(EvalCase, case_id)
    if not case:
        raise HTTPException(404, "case not found")
    allowed = {"rubric", "difficulty", "cluster_tag", "golden", "expected_output"}
    for k, v in payload.items():
        if k in allowed:
            setattr(case, k, v)
    db.commit()
    db.refresh(case)
    return EvalCaseOut.model_validate(case)


@router.delete("/{case_id}")
def delete_case(case_id: uuid.UUID, db: Annotated[Session, Depends(get_db)]) -> dict:
    case = db.get(EvalCase, case_id)
    if not case:
        raise HTTPException(404, "case not found")
    if case.golden:
        raise HTTPException(409, "golden cases cannot be deleted")
    db.delete(case)
    db.commit()
    return {"ok": True}
