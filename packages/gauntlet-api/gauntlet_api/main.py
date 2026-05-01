from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import (
    adversarial,
    clusters,
    drift,
    eval_cases,
    gate,
    runs,
    settings as settings_router,
    traces,
)

app = FastAPI(
    title="Gauntlet API",
    description="Eval-as-CI/CD for non-deterministic AI agents.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(traces.router)
app.include_router(eval_cases.router)
app.include_router(runs.router)
app.include_router(clusters.router)
app.include_router(adversarial.router)
app.include_router(gate.router)
app.include_router(drift.router)
app.include_router(settings_router.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "gauntlet-api"}
