# Gauntlet Architecture

Eval-as-CI/CD for non-deterministic agents. Six layers, one feedback loop.
The whole point: **the eval corpus must get harder over time, automatically.**

---

## System diagram

```
                                    ┌──────────────────────────────────────────┐
                                    │            USER'S AGENT (any)            │
                                    │  raw Anthropic │ LangGraph │ ADK │ ...   │
                                    └──────────────────┬───────────────────────┘
                                                       │ @gauntlet.trace
                                                       │ (3-line SDK, no framework deps)
                                                       ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │ LAYER 1 — TRACE COLLECTOR                                            │
        │  POST /v1/traces  →  validate  →  enqueue scoring job                │
        │  Stored: traces table (JSONB tree, tokens, cost, latency)            │
        └──────────────────┬───────────────────────────────────────────────────┘
                           │ trace_id  ──► Redis queue: "scoring"
                           ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │ LAYER 2 — SCORER ENGINE  (Celery worker, async)                      │
        │  ┌─ Deterministic ──┐   ┌─ Semantic (LLM-as-judge) ──────────────┐   │
        │  │ schema_valid     │   │ factual_consistency                    │   │
        │  │ tool_correctness │   │ compliance_language                    │   │
        │  │ token_budget     │   │ reasoning_coherence                    │   │
        │  │ latency_slo      │   │ task_completion                        │   │
        │  │ output_format    │   │  → logs: judge_model, prompt, conf,    │   │
        │  └──────────────────┘   │     reasoning, ts (full lineage)       │   │
        │                         └────────────────────────────────────────┘   │
        │  writes: trace.scores (JSONB), score_lineage rows                    │
        └──────────────────┬───────────────────────────────────────────────────┘
                           │ low-scoring trace ──► Redis queue: "classify"
                           ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │ LAYER 3 — FAILURE CLASSIFIER  (Celery, fast: <50ms)                  │
        │  pgvector embedding similarity vs seed examples per category         │
        │  writes: trace.failure_categories, FailureCluster.count_*            │
        │  threshold trigger: ≥3 failures / 7d in same cluster                 │
        └──────────────────┬───────────────────────────────────────────────────┘
                           │ cluster_id  ──► Redis queue: "adversarial"
                           ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │ LAYER 4 — ADVERSARIAL GENERATOR ✦ (Celery, the moat)                 │
        │  per failing input, apply 4 strategies in parallel:                  │
        │   1. semantic paraphrase (×10)                                       │
        │   2. persona variation                                               │
        │   3. edge case injection                                             │
        │   4. complexity escalation                                           │
        │  writes: AdversarialJob (status=review), generated_cases lineage     │
        │                                                                      │
        │     ┌─── Review UI ──► approve ──► EvalCase (generation_method=     │
        │     │                              "adversarial", parent_case_id)    │
        │     └─── promote-on-regression ──► EvalCase.golden = true            │
        └──────────────────┬───────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │ LAYER 5 — DEPLOY GATE  (sync, deterministic)                         │
        │  CLI: `gauntlet gate ...`     GH Action: gauntlet-ai/gauntlet-gate   │
        │  1. fetch corpus → SHA256(canonical-json) = corpus_hash              │
        │  2. CACHE LOOKUP (corpus_hash, agent_version) → return cached if hit │
        │  3. parallel run all cases → score → compare to baseline             │
        │  4. JSON report: pass_rate, regressions[], cost Δ, latency Δ         │
        │  5. PR comment via github API                                        │
        │  exit 0 (pass) | 1 (regression)                                      │
        └──────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────────────────────────────────┐
        │ LAYER 6 — DRIFT MONITOR  (live production sampling, default 5%)      │
        │  sampled prod traces → Layer 2 scorer (same code path)               │
        │  rolling distribution: 7d / 30d / vs last-gate                       │
        │  if |prod_pass − eval_pass| > threshold:                             │
        │     → alert (webhook + Slack + PagerDuty)                            │
        │     → auto-enqueue failing prod traces into Layer 4 generator queue  │
        │  ⇒ closes the loop: prod failures harden next corpus before deploy.  │
        └──────────────────────────────────────────────────────────────────────┘
```

## Queue topology (Redis / Celery)

| Queue          | Producer                       | Consumer worker         | Sync? |
|----------------|--------------------------------|-------------------------|-------|
| `scoring`      | trace ingest API               | scorer worker           | async |
| `classify`     | scorer worker (low score)      | classifier worker       | async |
| `adversarial`  | classifier (cluster threshold) | adversarial worker      | async |
| `gate`         | CLI / GH Action                | gate worker (parallel)  | sync* |
| `drift`        | drift sampler (cron)           | drift worker            | async |

*The gate is invoked synchronously from CI; internally it fans out runs in parallel
but blocks the caller until the report is final. Cached on (corpus_hash, agent_version).

## Sync vs async

- **Sync**: trace ingest (writes row, returns trace_id), gate (CI must block).
- **Async**: scoring, classification, adversarial generation, drift sampling.

## Persistence

- **Postgres 16** — primary datastore. JSONB for traces, scores, generated cases.
- **pgvector** — embedding storage for the failure classifier seed corpus.
- **Redis** — Celery broker + result backend, gate-result cache, idempotency keys.

## Determinism guarantees

- **Gate**: content-hash the corpus before every run; cache hit on
  `(corpus_hash, agent_version)` returns the prior report verbatim. No LLM call
  is non-deterministic from the gate's view because the gate consumes a
  pre-scored result row, not a re-judgment.
- **Scoring**: every semantic judgment row stores `judge_model`, `judge_prompt_hash`,
  `model_version`, `confidence`, `reasoning`, `timestamp`. Rerunning is a new row,
  never an overwrite — the audit trail is append-only.

## Framework agnosticism

`gauntlet-sdk` depends on: `httpx`, `pydantic`. Nothing else. No agent framework.
Three integration tests prove this: raw Anthropic, LangGraph, plain OpenAI call.
