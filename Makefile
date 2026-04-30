.PHONY: dev test gate seed migrate down logs api-shell psql install-sdk install-cli

dev:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api worker

migrate:
	docker compose exec api alembic upgrade head

seed:
	docker compose exec api python -m gauntlet_api.seed

test:
	docker compose exec api pytest -q

gate:
	docker compose exec api python -m gauntlet_cli.main gate \
		--agent-id user-story-agent --version local-dev --fail-on-regression

api-shell:
	docker compose exec api bash

psql:
	docker compose exec postgres psql -U gauntlet -d gauntlet

install-sdk:
	pip install -e packages/gauntlet-sdk

install-cli:
	pip install -e packages/gauntlet-cli
