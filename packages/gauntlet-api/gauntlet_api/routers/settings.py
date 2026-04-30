from __future__ import annotations

from fastapi import APIRouter

from ..config import get_settings

router = APIRouter(prefix="/v1/settings", tags=["settings"])


@router.get("")
def view_settings() -> dict:
    s = get_settings()
    return {
        "judge_model": s.judge_model,
        "cluster_failure_threshold_7d": s.cluster_failure_threshold_7d,
        "drift_sample_rate": s.drift_sample_rate,
        "drift_alert_threshold_pct": s.drift_alert_threshold_pct,
        "alerts": {
            "slack": bool(s.slack_webhook_url),
            "pagerduty": bool(s.pagerduty_routing_key),
            "webhook": bool(s.drift_webhook_url),
        },
    }
