#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env.prod}"
COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

${COMPOSE} build
${COMPOSE} up -d db
${COMPOSE} up -d backend
${COMPOSE} exec -T backend uv run python -m alembic upgrade head
${COMPOSE} up -d frontend proxy
${COMPOSE} ps
