"""Light-weight test setup that doesn't require a live Postgres.

For unit tests of the scorer engine, classifier, and adversarial generator we
don't need actual DB persistence — we exercise the pure-Python modules. Any
test that touches the real DB belongs in an integration suite.
"""
import sys
import types

# Tests should run without requiring environment setup; fall back to defaults.
import os
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://gauntlet:gauntlet@postgres:5432/gauntlet")
