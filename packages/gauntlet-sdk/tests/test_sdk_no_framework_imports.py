"""The build prompt is non-negotiable on this: gauntlet-sdk must not import
LangChain, LangGraph, or any agent framework. Import the SDK and assert no
framework module landed in sys.modules."""
import importlib
import sys


FORBIDDEN = ["langchain", "langgraph", "google.adk", "openai", "anthropic"]


def test_sdk_does_not_import_any_agent_framework():
    # Wipe any prior imports from earlier tests.
    for mod in list(sys.modules):
        if any(mod == f or mod.startswith(f + ".") for f in FORBIDDEN):
            sys.modules.pop(mod, None)

    importlib.import_module("gauntlet")

    leaked = [m for m in sys.modules if any(m == f or m.startswith(f + ".") for f in FORBIDDEN)]
    assert not leaked, f"gauntlet-sdk leaked agent-framework imports: {leaked}"
