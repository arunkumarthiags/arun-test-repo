"""Tiny deterministic embedding for the lightweight classifier.

The build prompt explicitly forbids GPT-4-class models here — this needs to be
fast (<50ms) and cheap. We use a stable hashing-bag-of-words embedding so the
classifier is fully reproducible across environments without any model
download. Plug in a real embedding (e.g. text-embedding-3-small) by replacing
`embed_text` — the rest of the pipeline is interface-stable.
"""
from __future__ import annotations

import hashlib
import math
import re
from typing import Iterable

DIM = 256


def _tokens(text: str) -> Iterable[str]:
    for tok in re.findall(r"[a-zA-Z]{3,}", (text or "").lower()):
        yield tok


def embed_text(text: str) -> list[float]:
    vec = [0.0] * DIM
    for tok in _tokens(text):
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
        idx = h % DIM
        sign = 1.0 if (h >> 8) & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
