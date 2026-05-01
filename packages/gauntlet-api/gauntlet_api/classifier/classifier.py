"""Lightweight failure classifier — embedding similarity against seed examples.

Target: <50ms per trace. No GPT-4-class model. Idempotent and append-only.
"""
from __future__ import annotations

import json
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ClassifierSeed, Trace
from .embeddings import cosine, embed_text
from .seeds import DEFAULT_SEEDS

SIMILARITY_THRESHOLD = 0.18


def ensure_seeds(db: Session) -> None:
    """Load the default seed corpus into the DB if empty."""
    n = db.execute(select(ClassifierSeed)).first()
    if n is not None:
        return
    for category, examples in DEFAULT_SEEDS.items():
        for text in examples:
            db.add(ClassifierSeed(category=category, text=text, embedding=embed_text(text)))
    db.commit()


def _trace_text(trace: Trace) -> str:
    parts: list[str] = []
    parts.append(json.dumps(trace.input, default=str))
    parts.append(json.dumps(trace.output, default=str))
    if trace.scores:
        for k, v in trace.scores.items():
            if isinstance(v, dict) and "reasoning" in v:
                parts.append(str(v.get("reasoning", "")))
    return " ".join(parts)[:4000]


def classify_trace(db: Session, trace: Trace) -> list[str]:
    """Return all categories the trace matches above threshold, sorted by score."""
    seeds = db.execute(select(ClassifierSeed)).scalars().all()
    if not seeds:
        ensure_seeds(db)
        seeds = db.execute(select(ClassifierSeed)).scalars().all()

    qvec = embed_text(_trace_text(trace))

    by_cat: dict[str, float] = {}
    for s in seeds:
        sim = cosine(qvec, s.embedding)
        if sim > by_cat.get(s.category, -1.0):
            by_cat[s.category] = sim

    matched = [(cat, score) for cat, score in by_cat.items() if score >= SIMILARITY_THRESHOLD]
    matched.sort(key=lambda x: x[1], reverse=True)
    # Cap to top 3 — anything beyond is noise.
    return [cat for cat, _ in matched[:3]]
