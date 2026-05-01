from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://gauntlet:gauntlet@postgres:5432/gauntlet"
    redis_url: str = "redis://redis:6379/0"
    gauntlet_env: str = "dev"

    # Layer 2 — scorer
    judge_model: str = "claude-sonnet-4-6"
    anthropic_api_key: str | None = None

    # Layer 3 — classifier threshold
    cluster_failure_threshold_7d: int = 3

    # Layer 6 — drift
    drift_sample_rate: float = 0.05
    drift_alert_threshold_pct: float = 10.0
    slack_webhook_url: str | None = None
    pagerduty_routing_key: str | None = None
    drift_webhook_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
