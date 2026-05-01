from __future__ import annotations

import os
import time
from typing import Any

import httpx


_CLIENT: "GauntletClient | None" = None


class GauntletClient:
    def __init__(
        self,
        api_url: str,
        api_key: str | None,
        agent_id: str,
        agent_version: str,
        timeout: float = 5.0,
    ) -> None:
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.agent_id = agent_id
        self.agent_version = agent_version
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        self._http = httpx.Client(timeout=timeout, headers=headers)

    def post_trace(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        try:
            r = self._http.post(f"{self.api_url}/v1/traces", json=payload)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            # Telemetry must never break the user's agent. Log to stderr.
            import sys
            print(f"[gauntlet] trace post failed: {e}", file=sys.stderr)
            return None


def init(
    *,
    api_key: str | None = None,
    agent_id: str,
    agent_version: str = "unknown",
    api_url: str | None = None,
) -> GauntletClient:
    global _CLIENT
    _CLIENT = GauntletClient(
        api_url=api_url or os.environ.get("GAUNTLET_API_URL", "http://localhost:8000"),
        api_key=api_key or os.environ.get("GAUNTLET_API_KEY"),
        agent_id=agent_id,
        agent_version=agent_version,
    )
    return _CLIENT


def get_client() -> GauntletClient | None:
    return _CLIENT
