# Gauntlet

Eval-as-CI/CD for non-deterministic AI agents. Six layers, one feedback loop.

The product belief: **a static eval suite for a non-deterministic agent is
worse than useless.** It gives false confidence while the agent drifts in
production. Gauntlet hardens the corpus automatically — production failures
become tomorrow's adversarial test cases before the next deploy.

```
trace collector → scorer → failure classifier → adversarial generator → deploy gate → drift monitor
                                                                                    ↑           ↓
                                                                                    └───────────┘
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the ASCII system diagram and queue topology.

## Quickstart

```bash
make dev          # starts api + worker + postgres + redis + frontend (vite)
make migrate      # alembic upgrade head
make seed         # loads the demo corpus (user-story-agent)
make test         # runs the test suite
make gate         # runs the deploy gate locally against the seeded corpus
```

Open the dashboard at <http://localhost:5173>.

## Three-line SDK

```python
import gauntlet
gauntlet.init(api_key="...", agent_id="my-agent", agent_version="1.3.0")

@gauntlet.trace
async def run_agent(input: str) -> str:
    ...  # your existing agent — unchanged
```

The SDK does not import LangChain, LangGraph, or any agent framework. It wraps
whatever you already have.

## Repo layout

```
packages/
  gauntlet-api/         FastAPI + Celery + Alembic; ships the CLI too (gauntlet_cli/)
  gauntlet-sdk/         pip-installable instrumentation package, no framework deps
frontend/               React 18 + Tailwind + Recharts (5 pages)
.github/actions/gauntlet-gate/   composite GitHub Action wrapping the CLI
ARCHITECTURE.md         system diagram, queue topology, determinism guarantees
docker-compose.yml      local dev (api + worker + postgres + redis + frontend)
docker-compose.prod.yml prod stack with nginx reverse proxy
Makefile                make dev | test | gate | seed | migrate
```

## Quality bars

- **Audit trail** — `score_lineage` rows record every judgment's model, prompt
  hash, full input payload, reasoning, confidence, timestamp.
- **Gate determinism** — `(agent_id, agent_version, corpus_hash)` is the cache
  key; identical inputs return the prior report verbatim. Tests in
  `tests/test_gate_determinism.py`.
- **Cost visibility** — every trace and gate run carries cost in USD. The
  dashboard surfaces cost trend; the gate report includes a cost delta.
- **Framework agnosticism** — `tests/test_sdk_no_framework_imports.py`
  asserts no LangChain/LangGraph/OpenAI module ends up in `sys.modules` after
  importing `gauntlet`.

## What ships

| Layer | Component | Path |
| --- | --- | --- |
| 1 | Trace collector + SDK | `packages/gauntlet-sdk/`, `routers/traces.py` |
| 2 | Scorer engine (deterministic + LLM-judge with lineage) | `gauntlet_api/scorers/` |
| 3 | Failure classifier (embedding similarity, <50ms target) | `gauntlet_api/classifier/` |
| 4 | Adversarial generator (4 strategies, review queue, golden promotion) | `gauntlet_api/adversarial/` |
| 5 | Deploy gate (CLI + GitHub Action, deterministic + cached) | `gauntlet_api/gate/`, `gauntlet_cli/`, `.github/actions/gauntlet-gate/` |
| 6 | Drift monitor (sample → alert → enqueue back into Layer 4) | `gauntlet_api/drift/` |
