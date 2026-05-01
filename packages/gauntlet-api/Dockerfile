# syntax=docker/dockerfile:1.6
#
# Multi-stage Dockerfile for gauntlet-api.
#
#   --target dev   → fast-iteration image with bind-mounted source and uvicorn --reload
#   --target prod  → slim, non-root, gunicorn+uvicorn workers, no build tools
#

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: base — common runtime layer (no build deps).
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Runtime libs only (libpq for psycopg, curl for the healthcheck).
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq5 curl \
 && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: builder — has compilers/headers; produces a populated /opt/venv.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# Isolated venv that we copy into the final stage.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Install deps first (better layer caching) using the project metadata.
COPY pyproject.toml /app/
RUN pip install --upgrade pip setuptools wheel \
 && pip install \
      "fastapi>=0.115" "uvicorn[standard]>=0.30" "gunicorn>=22.0" \
      "pydantic>=2.7" "pydantic-settings>=2.3" \
      "sqlalchemy>=2.0" "alembic>=1.13" "psycopg[binary]>=3.2" "pgvector>=0.3" \
      "redis>=5.0" "celery>=5.4" "httpx>=0.27" "click>=8.1" \
      "numpy>=1.26" "python-dateutil>=2.9" "tenacity>=9.0" "anthropic>=0.40"

# Now install the project itself (no deps — already installed above).
COPY . /app/
RUN pip install --no-deps -e /app

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: dev — keeps build tools so editable installs / migrations are easy.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS dev

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev curl \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml /app/
RUN pip install -e . || true

COPY . /app/
RUN pip install -e /app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "gauntlet_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4: prod — slim, non-root, no toolchain, gunicorn+uvicorn workers.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS prod

# Copy the prebuilt venv from the builder; build tools never enter this layer.
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Copy only the application source we need at runtime.
COPY --from=builder /app /app

# Create non-root user and hand over /app.
RUN groupadd --system --gid 1001 gauntlet \
 && useradd  --system --uid 1001 --gid gauntlet --no-create-home --shell /usr/sbin/nologin gauntlet \
 && chown -R gauntlet:gauntlet /app
USER gauntlet

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD curl -fsS http://localhost:8000/health || exit 1

# Sensible gunicorn defaults; override in compose for the worker service.
CMD ["gunicorn", "gauntlet_api.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "60", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
