from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..gate.gate import run_gate
from ..schemas import GateReport, GateRequest

router = APIRouter(prefix="/v1/gate", tags=["gate"])


@router.post("", response_model=GateReport)
def gate_endpoint(
    payload: GateRequest,
    db: Annotated[Session, Depends(get_db)],
) -> GateReport:
    """Run the deploy gate. Deterministic — cached on (corpus_hash, agent_version)."""
    return run_gate(
        db,
        agent_id=payload.agent_id,
        agent_version=payload.agent_version,
        fail_on_regression=payload.fail_on_regression,
        concurrency=payload.concurrency,
    )
