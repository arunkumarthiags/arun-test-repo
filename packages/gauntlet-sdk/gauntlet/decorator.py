"""@gauntlet.trace decorator. Works on sync and async callables."""
from __future__ import annotations

import asyncio
import functools
import inspect
import time
from dataclasses import asdict
from typing import Any, Callable

from .client import get_client
from .context import _TraceCtx, _active


def _serialize_input(args: tuple, kwargs: dict) -> dict:
    """Best-effort JSON-friendly snapshot of the input. Falls back to str() on
    anything non-serializable so we never crash the user's agent."""
    payload: dict[str, Any] = {}
    if args:
        payload["args"] = [_safe(a) for a in args]
    if kwargs:
        payload["kwargs"] = {k: _safe(v) for k, v in kwargs.items()}
    return payload


def _safe(v: Any) -> Any:
    try:
        import json
        json.dumps(v)
        return v
    except Exception:
        return str(v)


def trace(fn: Callable) -> Callable:
    """Wrap an agent invocation. Captures inputs, outputs, steps, latency,
    tokens, cost; posts a trace to the Gauntlet API on completion."""
    is_coro = asyncio.iscoroutinefunction(fn)

    @functools.wraps(fn)
    def sync_wrapper(*args, **kwargs):
        ctx = _TraceCtx()
        token = _active.set(ctx)
        t0 = time.perf_counter()
        try:
            out = fn(*args, **kwargs)
            return out
        finally:
            latency_ms = int((time.perf_counter() - t0) * 1000)
            _emit(ctx, args, kwargs, _grab_output(locals()), latency_ms)
            _active.reset(token)

    @functools.wraps(fn)
    async def async_wrapper(*args, **kwargs):
        ctx = _TraceCtx()
        token = _active.set(ctx)
        t0 = time.perf_counter()
        try:
            out = await fn(*args, **kwargs)
            return out
        finally:
            latency_ms = int((time.perf_counter() - t0) * 1000)
            _emit(ctx, args, kwargs, _grab_output(locals()), latency_ms)
            _active.reset(token)

    return async_wrapper if is_coro else sync_wrapper


def _grab_output(loc: dict) -> Any:
    """Reach into the wrapper's locals to grab the captured return value.
    Lightweight inspection trick — works because the var is named `out`."""
    return loc.get("out")


def _emit(ctx: _TraceCtx, args: tuple, kwargs: dict, output: Any, latency_ms: int) -> None:
    client = get_client()
    if client is None:
        return
    payload = {
        "agent_id": client.agent_id,
        "version": client.agent_version,
        "input": _serialize_input(args, kwargs),
        "output": _safe(output) if not isinstance(output, dict) else output,
        "steps": [asdict(s) for s in ctx.steps],
        "total_tokens": ctx.total_tokens,
        "total_cost_usd": ctx.total_cost_usd,
        "latency_ms": latency_ms,
        "source": "production",
    }
    # Wrap dict-output normalization: API expects output to be a dict.
    if not isinstance(payload["output"], dict):
        payload["output"] = {"value": payload["output"]}
    client.post_trace(payload)
