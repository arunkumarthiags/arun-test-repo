from celery import Celery

from ..config import get_settings

_settings = get_settings()

celery_app = Celery(
    "gauntlet",
    broker=_settings.redis_url,
    backend=_settings.redis_url,
    include=[
        "gauntlet_api.workers.tasks",
    ],
)

celery_app.conf.update(
    task_routes={
        "gauntlet.score_trace": {"queue": "scoring"},
        "gauntlet.classify_trace": {"queue": "classify"},
        "gauntlet.generate_adversarial": {"queue": "adversarial"},
        "gauntlet.drift_sample": {"queue": "drift"},
        "gauntlet.gate_run_case": {"queue": "gate"},
    },
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=2,
)
