"""gauntlet — 3-line agent instrumentation.

    import gauntlet
    gauntlet.init(api_key="...", agent_id="my-agent")

    @gauntlet.trace
    async def run_agent(input):
        ...

This package depends only on httpx and pydantic. It MUST NOT import LangChain,
LangGraph, or any agent framework — it wraps whatever the user already has.
"""
from .client import GauntletClient, init, get_client
from .decorator import trace
from .context import current_step, record_tool_call, record_reasoning, record_tokens

__all__ = [
    "GauntletClient",
    "init",
    "get_client",
    "trace",
    "current_step",
    "record_tool_call",
    "record_reasoning",
    "record_tokens",
]
