"""Deploy gate.

Hard requirements from the build prompt:
  - Same corpus + same agent version = same result, every time.
  - Content-hash the corpus before every run.
  - Cache hit on (corpus_hash, agent_version) returns the prior report.
  - Exit 0 on pass, 1 on regression.
  - JSON report: pass_rate, regressions[], coverage_gaps, cost Δ, latency Δ.
"""
from __future__ import annotations

import hashlib
import json
import statistics
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..adversarial.generator import promote_to_golden_if_caught_regression
from ..models import EvalCase, GateRun, RunResult, Trace
from ..schemas import GateRegressionEntry, GateReport
from ..scorers.engine import score_trace


def _canonical_corpus(corpus: list[EvalCase]) -> str:
    """Stable JSON over the corpus for hashing.

    Includes the case IDs and their semantic content (input, rubric, difficulty,
    cluster_tag, generation_method, golden). Excludes timestamps and stats.
    """
    payload = sorted(
        [
            {
                "id": str(c.id),
                "input": c.input,
                "rubric": c.rubric,
                "difficulty": c.difficulty,
                "cluster_tag": c.cluster_tag,
                "generation_method": c.generation_method,
                "golden": c.golden,
            }
            for c in corpus
        ],
        key=lambda d: d["id"],
    )
    return json.dumps(payload, sort_keys=True, default=str)


def corpus_hash(corpus: list[EvalCase]) -> str:
    return hashlib.sha256(_canonical_corpus(corpus).encode("utf-8")).hexdigest()


def _simulate_agent_run(case: EvalCase, agent_version: str) -> Trace:
    """Stand-in for the user's real agent — kept here so `gauntlet gate` runs
    without needing the user to wire up their actual agent. Replace with a real
    HTTP call to the user's deployed agent (URL from env / agent config) in
    production."""
    # Deterministic per (case.id, agent_version) so the gate's own cache works
    # in CI without flakes. In the real flow the user's @gauntlet.trace call
    # would supply the trace via the SDK.
    seed = int(hashlib.md5(f"{case.id}-{agent_version}".encode()).hexdigest(), 16)
    rng = (seed % 100) / 100.0

    output = {
        "title": f"Story for case {str(case.id)[:8]}",
        "acceptance_criteria": ["Given X", "When Y", "Then Z"],
    }
    # Difficulty raises failure probability deterministically.
    fail_prob = (case.difficulty - 1) / 6.0
    if rng < fail_prob:
        output["acceptance_criteria"] = ["incomplete"]

    return Trace(
        agent_id=case.agent_id,
        version=agent_version,
        input=case.input,
        output=output,
        steps=[
            {"kind": "reasoning", "name": "plan", "tokens": 120, "cost_usd": 0.001},
            {"kind": "completion", "name": "write_story", "tokens": 380, "cost_usd": 0.003},
        ],
        total_tokens=500,
        total_cost_usd=0.004,
        latency_ms=int(800 + rng * 4000),
        source="eval",
        eval_case_id=case.id,
    )


def _previous_baseline(db: Session, agent_id: str) -> dict[uuid.UUID, bool] | None:
    """Last completed gate run's per-case pass map for regression diffing."""
    last = db.execute(
        select(GateRun)
        .where(GateRun.agent_id == agent_id)
        .order_by(GateRun.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if not last:
        return None
    return {uuid.UUID(k): v for k, v in (last.report.get("per_case_pass", {}) or {}).items()}


def _previous_cost_latency(db: Session, agent_id: str) -> tuple[float, int]:
    last = db.execute(
        select(GateRun)
        .where(GateRun.agent_id == agent_id)
        .order_by(GateRun.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if not last:
        return 0.0, 0
    return float(last.cost_usd or 0.0), int(last.latency_p50_ms or 0)


def run_gate(
    db: Session,
    *,
    agent_id: str,
    agent_version: str,
    fail_on_regression: bool = True,
    concurrency: int = 8,
) -> GateReport:
    corpus: list[EvalCase] = db.execute(
        select(EvalCase).where(EvalCase.agent_id == agent_id)
    ).scalars().all()

    chash = corpus_hash(corpus)

    # ── Cache lookup — determinism guarantee ──────────────────────────────
    cached = db.execute(
        select(GateRun).where(
            GateRun.agent_id == agent_id,
            GateRun.agent_version == agent_version,
            GateRun.corpus_hash == chash,
        )
    ).scalar_one_or_none()
    if cached is not None:
        report_dict = dict(cached.report)
        report_dict["cached"] = True
        return GateReport(**report_dict)

    # Run cases. Network calls to the user's deployed agent would be the
    # actual IO; we keep the pool but execute simulate-and-score sequentially
    # because the SQLAlchemy session is not thread-safe. Replace _simulate
    # with an HTTP call and split scoring off-thread for real concurrency.
    def _run(case: EvalCase) -> tuple[EvalCase, Trace, dict]:
        trace = _simulate_agent_run(case, agent_version)
        db.add(trace)
        db.flush()
        result = score_trace(db, trace)
        return case, trace, result

    results = [_run(c) for c in corpus]

    baseline = _previous_baseline(db, agent_id) or {}
    prev_cost, prev_latency_p50 = _previous_cost_latency(db, agent_id)

    n = len(results)
    n_pass = sum(1 for _, _, r in results if r["passed"])
    pass_rate = n_pass / n if n else 0.0
    cost_total = sum(t.total_cost_usd or 0.0 for _, t, _ in results)
    latencies = [t.latency_ms or 0 for _, t, _ in results]
    p50 = int(statistics.median(latencies)) if latencies else 0

    regressions: list[GateRegressionEntry] = []
    coverage_gaps: dict[str, int] = {}
    per_case_pass: dict[str, bool] = {}

    for case, trace, result in results:
        passed = result["passed"]
        per_case_pass[str(case.id)] = passed
        prev = baseline.get(case.id)
        is_regression = bool(prev is True and not passed)
        if is_regression:
            regressions.append(GateRegressionEntry(
                eval_case_id=case.id,
                cluster_tag=case.cluster_tag,
                previous_pass=True,
                current_pass=False,
                rubric_summary=(case.rubric or "")[:160],
            ))
            promote_to_golden_if_caught_regression(db, case.id)

        if prev is None:
            coverage_gaps[case.cluster_tag] = coverage_gaps.get(case.cluster_tag, 0) + 1

        db.add(RunResult(
            eval_case_id=case.id,
            agent_version=agent_version,
            trace_id=trace.id,
            passed=passed,
            scores=trace.scores,
            regression=is_regression,
        ))

    exit_code = 1 if (fail_on_regression and regressions) else 0

    report = GateReport(
        agent_id=agent_id,
        agent_version=agent_version,
        corpus_hash=chash,
        pass_rate=round(pass_rate, 4),
        n_cases=n,
        n_regressions=len(regressions),
        regressions=regressions,
        coverage_gaps=coverage_gaps,
        cost_usd=round(cost_total, 4),
        cost_delta_usd=round(cost_total - prev_cost, 4),
        latency_p50_ms=p50,
        latency_delta_ms=p50 - prev_latency_p50,
        cached=False,
        exit_code=exit_code,
    )

    # Persist (cache) the run.
    report_dict = report.model_dump(mode="json")
    report_dict["per_case_pass"] = per_case_pass
    db.add(GateRun(
        agent_id=agent_id,
        agent_version=agent_version,
        corpus_hash=chash,
        pass_rate=report.pass_rate,
        regressions=[r.model_dump(mode="json") for r in regressions],
        cost_usd=report.cost_usd,
        cost_delta_usd=report.cost_delta_usd,
        latency_p50_ms=report.latency_p50_ms,
        latency_delta_ms=report.latency_delta_ms,
        report=report_dict,
        cached=False,
    ))
    db.commit()
    return report


def render_pr_markdown(report: GateReport) -> str:
    """Markdown summary for posting as a PR comment."""
    rows = "\n".join(
        f"| {r.cluster_tag} | {str(r.eval_case_id)[:8]} | {r.rubric_summary[:60]} |"
        for r in report.regressions[:25]
    )
    if not rows:
        rows = "| — | — | _no regressions_ |"
    cost_sym = "▲" if report.cost_delta_usd > 0 else ("▼" if report.cost_delta_usd < 0 else "≈")
    lat_sym = "▲" if report.latency_delta_ms > 0 else ("▼" if report.latency_delta_ms < 0 else "≈")
    return f"""## Gauntlet — agent `{report.agent_id}` @ `{report.agent_version}`

| Metric | Value |
| --- | --- |
| Pass rate | **{report.pass_rate:.1%}** ({report.n_cases} cases) |
| Regressions | **{report.n_regressions}** |
| Cost | ${report.cost_usd:.4f} ({cost_sym} ${report.cost_delta_usd:+.4f}) |
| Latency p50 | {report.latency_p50_ms}ms ({lat_sym} {report.latency_delta_ms:+d}ms) |
| Corpus hash | `{report.corpus_hash[:12]}…` |
| Cached | {"yes" if report.cached else "no"} |

### Regressions

| cluster | case | rubric |
| --- | --- | --- |
{rows}

_Exit code: **{report.exit_code}**._
"""
