"""Test harness for gauntlet-api.

Two layers of fixtures:

1) For pure-Python unit tests (existing scorers / classifier / adversarial /
   gate hash / semantic) — no DB needed. Importing this conftest is harmless;
   we just set sane defaults so importing config doesn't blow up.

2) For integration tests that need real persistence we wire up a real Postgres
   on localhost:5432 (already running for the dev environment; another agent
   manages the prod compose). We:

     * use a dedicated database `gauntlet_test`,
     * run `Base.metadata.create_all` once per session (Postgres-native types
       like JSONB, ARRAY, UUID work natively),
     * monkey-patch `gauntlet_api.db.engine` and `SessionLocal` to point at
       the test DB so the FastAPI app and the gate / drift / scorer modules
       all share the same engine,
     * provide a `db` fixture yielding a SQLAlchemy session whose work is
       rolled back at the end of each test, and
     * provide a `client` fixture wired to the same session via FastAPI
       dependency override.

   We chose real Postgres over SQLite because the production schema uses
   JSONB and ARRAY(UUID) columns which SQLite cannot back. Using the same
   database engine in tests means our test traces exercise the same query
   plans as production — which is the whole point of "Gauntlet eats its own
   cooking".
"""
from __future__ import annotations

import os
import sys
import types

# Defaults so importing config never crashes in pure-unit-test mode.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://gauntlet:gauntlet@localhost:5432/gauntlet_test",
)

import pytest


def _force_celery_eager() -> None:
    """Make `.delay()` execute the task body inline so tests don't depend on a
    running Celery worker. Importing celery_app here also wires module load."""
    try:
        from gauntlet_api.workers.celery_app import celery_app
        celery_app.conf.task_always_eager = True
        celery_app.conf.task_eager_propagates = False
        celery_app.conf.broker_url = "memory://"
        celery_app.conf.result_backend = "cache+memory://"
    except Exception:
        pass


_force_celery_eager()


TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://gauntlet:gauntlet@localhost:5432/gauntlet_test",
)


def _postgres_available() -> bool:
    try:
        from sqlalchemy import create_engine, text
        eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True, future=True)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


_HAS_PG = _postgres_available()


@pytest.fixture(scope="session")
def _engine():
    """Session-scoped engine pointed at the test DB.

    Also rebinds `gauntlet_api.db.engine` and `SessionLocal` so all production
    code paths (routers, gate, drift) use the test engine via `get_db`.
    """
    if not _HAS_PG:
        pytest.skip(
            f"integration tests require Postgres at {TEST_DATABASE_URL!r}; "
            "set TEST_DATABASE_URL or skip this test"
        )

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from gauntlet_api import db as db_module
    from gauntlet_api import models  # noqa: F401  ensure model classes register

    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True, future=True)
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, future=True
    )

    # Rebind production module-level handles. Routers grab SessionLocal at
    # request time via get_db, so this swap reaches them.
    db_module.engine = engine
    db_module.SessionLocal = TestingSessionLocal

    # Create schema (idempotent).
    db_module.Base.metadata.create_all(bind=engine)

    yield engine

    engine.dispose()


@pytest.fixture()
def db(_engine):
    """Per-test session. Cleans every table after the test so tests are
    isolated without expensive create/drop cycles.
    """
    from sqlalchemy.orm import sessionmaker

    Session = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        # Truncate all tables for isolation. Order is handled by CASCADE.
        from gauntlet_api.db import Base
        with _engine.begin() as conn:
            from sqlalchemy import text
            tables = ", ".join(
                f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables)
            )
            if tables:
                conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture()
def client(db, _engine):
    """FastAPI TestClient with `get_db` overridden to share `db`'s session.

    Yields the same session the test sees, so a router commit is visible to
    the test and vice versa.
    """
    from fastapi.testclient import TestClient
    from gauntlet_api.db import get_db
    from gauntlet_api.main import app

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
