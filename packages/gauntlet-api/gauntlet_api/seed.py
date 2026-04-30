"""Seed data — make the value prop obvious in 60 seconds.

Loads:
  - 50 eval cases across 5 failure clusters with the configured distribution
  - 30 traces (20 passing easy, 10 failing hard)
  - One completed adversarial job with 15 generated variants (8 approved / 7 rejected)
  - Gate run history v1.1 → v1.4 (v1.3 caught a regression and blocked)
  - 12 percentage-point eval-to-prod drift gap with an alert fired 3 days ago
"""
from __future__ import annotations

import hashlib
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from .classifier.classifier import ensure_seeds
from .db import SessionLocal
from .models import (
    AdversarialJob,
    DriftSample,
    EvalCase,
    FailureCluster,
    GateRun,
    RunResult,
    Trace,
)

AGENT_ID = "user-story-agent"

CLUSTER_DISTRIBUTION: list[tuple[str, str, int]] = [
    ("compliance_language_failure", "Output uses prohibited absolute claims for regulated contexts.", 20),
    ("international_context",       "Agent assumes US defaults when international context is implied.", 12),
    ("regulatory_feature",          "Feature requires HIPAA/PCI/SOX controls but agent omits them.",   8),
    ("ambiguous_requirement",       "Requirement is ambiguous; agent fabricated detail rather than asking.", 6),
    ("nested_dependency",           "Multi-step dependency was flattened or executed out of order.",   4),
]

PROMPT_TEMPLATES: dict[str, list[str]] = {
    "compliance_language_failure": [
        "Build a feature that lets users see how our investment product guarantees returns.",
        "Add UI copy: 'never lose money' for the savings widget.",
        "User story: marketing wants to advertise 'risk-free' onboarding.",
        "Promote: 'we always beat the market' on the home page.",
    ],
    "international_context": [
        "Roll out the savings product to UK customers next quarter.",
        "Localize the dashboard for EU users; reuse all existing copy.",
        "Australian launch: keep the same disclosures.",
    ],
    "regulatory_feature": [
        "Add patient note export to the clinician portal.",
        "Store credit card numbers locally for faster checkout.",
        "Auto-archive financial reports after 30 days.",
    ],
    "ambiguous_requirement": [
        "Make the dashboard better.",
        "Improve onboarding.",
    ],
    "nested_dependency": [
        "When the user upgrades, also notify their team and migrate their settings, but only if billing succeeded.",
        "Run the report; if it fails, retry; if retry fails, alert; if alert fails, log.",
    ],
}


def _ts(days_ago: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def seed() -> None:
    rng = random.Random(0xA11CE)

    with SessionLocal() as db:
        # Clean slate (idempotent re-seed).
        for tbl in [DriftSample, RunResult, GateRun, AdversarialJob, FailureCluster, Trace, EvalCase]:
            db.execute(delete(tbl))
        db.commit()

        ensure_seeds(db)

        # ── 50 eval cases across 5 clusters ────────────────────────────────
        cases_by_cluster: dict[str, list[EvalCase]] = {}
        for cluster_name, _desc, count in CLUSTER_DISTRIBUTION:
            cases_by_cluster[cluster_name] = []
            templates = PROMPT_TEMPLATES.get(cluster_name, ["Generic story."])
            for i in range(count):
                req = templates[i % len(templates)]
                difficulty = 1 + (i % 5)
                case = EvalCase(
                    agent_id=AGENT_ID,
                    input={
                        "request": req,
                        "sources": ["product-charter.md", "compliance-policy-v3.pdf"],
                    },
                    expected_output={
                        "title": "User Story",
                        "acceptance_criteria": ["Given X", "When Y", "Then Z"],
                    },
                    rubric=(
                        "Produce a structured user story with title and acceptance "
                        "criteria. Use compliant language; do not make absolute "
                        "claims; respect international/regulated context."
                    ),
                    difficulty=difficulty,
                    cluster_tag=cluster_name,
                    generation_method="human",
                )
                db.add(case)
                cases_by_cluster[cluster_name].append(case)
        db.commit()

        # ── 30 traces: 20 passing on easy, 10 failing on hard ──────────────
        all_cases: list[EvalCase] = [c for cs in cases_by_cluster.values() for c in cs]
        easy_cases = [c for c in all_cases if c.difficulty <= 2]
        hard_cases = [c for c in all_cases if c.difficulty >= 4]

        passing_traces: list[Trace] = []
        for c in rng.sample(easy_cases, min(20, len(easy_cases))):
            t = Trace(
                agent_id=AGENT_ID,
                version="v1.4",
                timestamp=_ts(rng.uniform(0.1, 5)),
                input=c.input,
                output={
                    "title": f"Story for {c.input['request'][:40]}",
                    "acceptance_criteria": ["Given …", "When …", "Then …"],
                },
                steps=[
                    {"kind": "reasoning", "name": "plan", "tokens": 110, "cost_usd": 0.0009},
                    {"kind": "completion", "name": "write_story", "tokens": 360, "cost_usd": 0.003},
                ],
                total_tokens=470,
                total_cost_usd=0.0039,
                latency_ms=int(rng.uniform(900, 3000)),
                scores={"__rollup__": {"overall_score": 0.92, "passed": True, "pass_threshold": 0.7}},
                source="eval",
                eval_case_id=c.id,
            )
            db.add(t)
            passing_traces.append(t)

        failing_traces: list[Trace] = []
        for c in rng.sample(hard_cases, min(10, len(hard_cases))):
            t = Trace(
                agent_id=AGENT_ID,
                version="v1.4",
                timestamp=_ts(rng.uniform(0.1, 5)),
                input=c.input,
                output={
                    "title": f"Story for {c.input['request'][:40]}",
                    "acceptance_criteria": [
                        "guarantee zero downtime",
                        "always beats baseline",
                    ],
                },
                steps=[
                    {"kind": "reasoning", "name": "plan", "tokens": 90, "cost_usd": 0.0008},
                    {"kind": "completion", "name": "write_story", "tokens": 410, "cost_usd": 0.0035},
                ],
                total_tokens=500,
                total_cost_usd=0.0043,
                latency_ms=int(rng.uniform(2500, 7000)),
                scores={
                    "__rollup__": {"overall_score": 0.41, "passed": False, "pass_threshold": 0.7},
                    "compliance_language": {"score": 0.2, "reasoning": "uses 'guarantee', 'always'"},
                },
                failure_categories=[c.cluster_tag],
                source="eval",
                eval_case_id=c.id,
            )
            db.add(t)
            failing_traces.append(t)
        db.commit()

        # ── Failure clusters with the dominant compliance bucket ───────────
        cluster_objs: dict[str, FailureCluster] = {}
        for cluster_name, desc, count in CLUSTER_DISTRIBUTION:
            example_ids = [t.id for t in failing_traces if cluster_name in (t.failure_categories or [])][:5]
            if not example_ids and failing_traces:
                example_ids = [failing_traces[0].id]
            cluster = FailureCluster(
                agent_id=AGENT_ID,
                name=cluster_name,
                description=desc,
                count_7d=count,
                count_30d=int(count * 1.6),
                example_trace_ids=example_ids,
                adversarial_queue_triggered_at=_ts(2.0) if cluster_name == "compliance_language_failure" else None,
            )
            db.add(cluster)
            cluster_objs[cluster_name] = cluster
        db.commit()

        # ── Adversarial job: 15 variants on top compliance failure ─────────
        top_cluster = cluster_objs["compliance_language_failure"]
        seed_trace = next((t for t in failing_traces if "compliance_language_failure" in (t.failure_categories or [])), failing_traces[0])

        from .adversarial.strategies import all_strategies
        all_variants = list(all_strategies(seed_trace.input))
        variants = all_variants[:15]

        # Simulate review decisions: 8 approved / 7 rejected, deterministic.
        for i, v in enumerate(variants):
            v["cluster_tag"] = top_cluster.name
            v["parent_trace_id"] = str(seed_trace.id)
            v["parent_case_id"] = str(seed_trace.eval_case_id)
            v["rubric"] = "Compliant phrasing; no absolute claims."
            v["expected_output"] = None
            v["approved"] = bool(i % 2 == 0)  # 8 approvals out of 15

        approved_subset = [v for v in variants if v["approved"]]
        for v in approved_subset:
            promoted = EvalCase(
                agent_id=AGENT_ID,
                input=v["input"],
                rubric=v["rubric"],
                difficulty=v["difficulty"],
                cluster_tag=top_cluster.name,
                generation_method="adversarial",
                parent_case_id=uuid.UUID(v["parent_case_id"]) if v.get("parent_case_id") else None,
            )
            db.add(promoted)
            db.flush()
            v["promoted_eval_case_id"] = str(promoted.id)

        job = AdversarialJob(
            cluster_id=top_cluster.id,
            status="approved",
            generated_cases=variants,
            reviewer_notes="Approved 8 / 15 — rejected paraphrases that drifted from intent.",
            created_at=_ts(2.5),
            approved_at=_ts(2.0),
        )
        db.add(job)
        db.commit()

        # ── Gate runs v1.1 → v1.4 ──────────────────────────────────────────
        from sqlalchemy import select as _select
        eval_cases = db.execute(
            _select(EvalCase).where(EvalCase.agent_id == AGENT_ID)
        ).scalars().all()
        case_ids = [c.id for c in eval_cases]

        def per_case_pass(version: str, fail_set: set[uuid.UUID]) -> dict:
            return {str(cid): (cid not in fail_set) for cid in case_ids}

        baseline_fails: set[uuid.UUID] = set(case_ids[-5:])  # 5 failing on v1.1
        v11 = baseline_fails
        v12 = baseline_fails  # same as v1.1 — clean pass
        v13 = baseline_fails | set(case_ids[10:13])  # 3 NEW regressions in compliance
        v14 = baseline_fails  # back to baseline after fix

        runs = [
            ("v1.1", v11, _ts(20),  0.0125, 1850, False),
            ("v1.2", v12, _ts(14),  0.0131, 1900, False),
            ("v1.3", v13, _ts(7),   0.0142, 2050, True),   # blocked
            ("v1.4", v14, _ts(1),   0.0119, 1820, False),  # fix passed
        ]

        prev_cost = 0.0
        prev_lat = 0
        chash = hashlib.sha256(b"seed-corpus-v1").hexdigest()

        for version, fails, ts, cost, lat, blocked in runs:
            n = len(case_ids)
            n_pass = n - len(fails)
            regressions = []
            if version == "v1.3":
                for cid in (case_ids[10:13]):
                    case = next(c for c in eval_cases if c.id == cid)
                    regressions.append({
                        "eval_case_id": str(cid),
                        "cluster_tag": case.cluster_tag,
                        "previous_pass": True,
                        "current_pass": False,
                        "rubric_summary": (case.rubric or "")[:160],
                    })
            report = {
                "agent_id": AGENT_ID,
                "agent_version": version,
                "corpus_hash": chash,
                "pass_rate": round(n_pass / n, 4),
                "n_cases": n,
                "n_regressions": len(regressions),
                "regressions": regressions,
                "coverage_gaps": {},
                "cost_usd": cost,
                "cost_delta_usd": round(cost - prev_cost, 4),
                "latency_p50_ms": lat,
                "latency_delta_ms": lat - prev_lat,
                "cached": False,
                "exit_code": 1 if blocked else 0,
                "per_case_pass": per_case_pass(version, fails),
            }
            db.add(GateRun(
                agent_id=AGENT_ID,
                agent_version=version,
                corpus_hash=chash,
                pass_rate=report["pass_rate"],
                regressions=regressions,
                cost_usd=cost,
                cost_delta_usd=report["cost_delta_usd"],
                latency_p50_ms=lat,
                latency_delta_ms=report["latency_delta_ms"],
                report=report,
                cached=False,
                created_at=ts,
            ))
            prev_cost, prev_lat = cost, lat
        db.commit()

        # ── Drift: 12pp eval-to-prod gap, alert 3 days ago ────────────────
        for d in range(30, -1, -1):
            ts = _ts(d)
            base = 0.92
            prod = base - (0.12 if d <= 4 else rng.uniform(0.0, 0.04))
            delta = round((base - prod) * 100, 2)
            alert = (d == 3 and delta >= 10.0)
            # Need an attached prod trace; create a small one inline.
            t = Trace(
                agent_id=AGENT_ID,
                version="v1.4",
                timestamp=ts,
                input={"request": "prod sample"},
                output={"title": "x", "acceptance_criteria": ["a"]},
                steps=[],
                total_tokens=300, total_cost_usd=0.0025, latency_ms=1500,
                scores={"__rollup__": {"overall_score": prod, "passed": prod >= 0.7, "pass_threshold": 0.7}},
                failure_categories=[] if prod >= 0.7 else ["compliance_language_failure"],
                source="production",
            )
            db.add(t)
            db.flush()
            db.add(DriftSample(
                agent_id=AGENT_ID,
                trace_id=t.id,
                pass_rate_window_7d=prod,
                eval_pass_rate_baseline=base,
                delta_pct=delta,
                alert_fired=alert,
                created_at=ts,
            ))
        db.commit()

        print(f"seeded — agent_id={AGENT_ID}")


if __name__ == "__main__":
    seed()
