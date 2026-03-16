#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env.prod}"
docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml down
