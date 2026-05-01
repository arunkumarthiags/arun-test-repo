"""Trace-context — a contextvar-backed accumulator that the @gauntlet.trace
decorator opens for the duration of one agent invocation.

User-callable helpers (record_tool_call, record_reasoning, record_tokens) write
into the active trace's step list. If no trace is active they are a no-op."""
from __future__ import annotations

import contextvars
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class _Step:
    kind: str
    name: str | None = None
    input: Any = None
    output: Any = None
    tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0


@dataclass
class _TraceCtx:
    steps: list[_Step] = field(default_factory=list)
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    started_at: float = field(default_factory=time.perf_counter)


_active: contextvars.ContextVar[_TraceCtx | None] = contextvars.ContextVar(
    "gauntlet_trace", default=None
)


def _ctx() -> _TraceCtx | None:
    return _active.get()


def current_step() -> _TraceCtx | None:
    return _ctx()


def record_tool_call(
    name: str,
    input: Any = None,
    output: Any = None,
    *,
    tokens: int = 0,
    cost_usd: float = 0.0,
    latency_ms: int = 0,
) -> None:
    ctx = _ctx()
    if ctx is None:
        return
    ctx.steps.append(_Step(
        kind="tool_call", name=name, input=input, output=output,
        tokens=tokens, cost_usd=cost_usd, latency_ms=latency_ms,
    ))
    ctx.total_tokens += tokens
    ctx.total_cost_usd += cost_usd


def record_reasoning(text: str, *, tokens: int = 0, cost_usd: float = 0.0) -> None:
    ctx = _ctx()
    if ctx is None:
        return
    ctx.steps.append(_Step(kind="reasoning", name="reasoning", output=text, tokens=tokens, cost_usd=cost_usd))
    ctx.total_tokens += tokens
    ctx.total_cost_usd += cost_usd


def record_tokens(tokens: int, cost_usd: float = 0.0) -> None:
    ctx = _ctx()
    if ctx is None:
        return
    ctx.total_tokens += tokens
    ctx.total_cost_usd += cost_usd
