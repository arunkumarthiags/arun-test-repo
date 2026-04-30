"""Three integration tests proving framework agnosticism without making real
network calls. The SDK wraps the user's code; it does not import the framework
itself.

  1. Raw Anthropic API (mocked client object)
  2. LangGraph agent (mocked node function)
  3. Plain Python function calling OpenAI (mocked)
"""
from unittest.mock import MagicMock

import gauntlet


def test_wraps_raw_anthropic_call(monkeypatch):
    fake_client = MagicMock()
    fake_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="hi", type="text")]
    )

    @gauntlet.trace
    def call_claude(prompt):
        msg = fake_client.messages.create(model="m", messages=[{"role": "user", "content": prompt}])
        gauntlet.record_tokens(50, 0.0005)
        return {"text": msg.content[0].text}

    out = call_claude("hello")
    assert out == {"text": "hi"}


def test_wraps_langgraph_style_node():
    # Simulate a LangGraph-style node function. Gauntlet has no LangGraph dep —
    # we just wrap a normal callable that returns a state dict.
    def node(state):
        gauntlet.record_tool_call("search_docs", input=state, output={"hits": []}, tokens=20)
        return {**state, "answer": "ok"}

    wrapped = gauntlet.trace(node)
    out = wrapped({"q": "foo"})
    assert out["answer"] == "ok"


def test_wraps_openai_style_call():
    fake = MagicMock()
    fake.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="42"))]
    )

    @gauntlet.trace
    def ask(q):
        r = fake.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": q}])
        gauntlet.record_tokens(80, 0.0008)
        return {"answer": r.choices[0].message.content}

    out = ask("life?")
    assert out == {"answer": "42"}
