.PHONY: dev test gate seed migrate down logs api-shell psql install-sdk install-cli \
        prod-up prod-down prod-build prod-logs prod-ps prod-migrate

# ─── compose file shortcuts ──────────────────────────────────────────────────
DC      := docker compose
DC_PROD := docker compose -f docker-compose.prod.yml

# ─── dev ─────────────────────────────────────────────────────────────────────
dev:
	$(DC) up --build

down:
	$(DC) down

logs:
	$(DC) logs -f api worker

migrate:
	$(DC) exec api alembic upgrade head

seed:
	$(DC) exec api python -m gauntlet_api.seed

test:
	$(DC) exec api pytest -q

gate:
	$(DC) exec api python -m gauntlet_cli.main gate \
		--agent-id user-story-agent --version local-dev --fail-on-regression

api-shell:
	$(DC) exec api bash

psql:
	$(DC) exec postgres psql -U gauntlet -d gauntlet

install-sdk:
	pip install -e packages/gauntlet-sdk

install-cli:
	pip install -e packages/gauntlet-cli

# ─── prod ────────────────────────────────────────────────────────────────────
prod-build:
	$(DC_PROD) build

prod-up:
	$(DC_PROD) up -d

prod-down:
	$(DC_PROD) down

prod-logs:
	$(DC_PROD) logs -f api worker nginx

prod-ps:
	$(DC_PROD) ps

prod-migrate:
	$(DC_PROD) run --rm api alembic upgrade head
