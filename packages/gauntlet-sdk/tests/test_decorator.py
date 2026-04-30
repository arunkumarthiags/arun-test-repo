"""Decorator works on sync and async, captures steps, never crashes when no
client is configured."""
import asyncio

import gauntlet


def test_sync_trace_runs_without_client():
    @gauntlet.trace
    def f(x):
        gauntlet.record_reasoning("thinking", tokens=10)
        gauntlet.record_tool_call("search", input={"q": x}, output={"hits": 1}, tokens=20)
        return {"answer": x * 2}

    assert f(5) == {"answer": 10}


def test_async_trace_runs_without_client():
    @gauntlet.trace
    async def g(x):
        gauntlet.record_tokens(tokens=42, cost_usd=0.001)
        return {"v": x}

    assert asyncio.run(g(7)) == {"v": 7}


def test_record_helpers_are_noops_outside_a_trace():
    # Must not raise when no @gauntlet.trace is active.
    gauntlet.record_reasoning("nope")
    gauntlet.record_tool_call("nope")
    gauntlet.record_tokens(0)
