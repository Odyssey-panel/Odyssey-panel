#!/bin/sh
# Container entrypoint: ensure schema + seed defaults, then start the server.
set -e

echo "[boot] DATABASE_URL=${DATABASE_URL:-<unset>}"

echo "[boot] applying database schema (prisma db push)…"
node node_modules/prisma/build/index.js db push --schema prisma/schema.prisma --skip-generate || \
  echo "[boot] WARNING: db push failed — continuing with existing schema"

echo "[boot] seeding defaults if empty…"
node prisma/seed.boot.mjs || true

echo "[boot] starting server on port ${PORT:-8080}"
exec node server.js
