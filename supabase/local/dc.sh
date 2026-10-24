#!/bin/sh
# docker compose cu fișierele stivei locale (+ un fișier suplimentar opțional în $EXTRA_COMPOSE)
cd "$(dirname "$0")" && exec docker compose --env-file dev.env -f docker-compose.yml ${EXTRA_COMPOSE:+-f "$EXTRA_COMPOSE"} "$@"
