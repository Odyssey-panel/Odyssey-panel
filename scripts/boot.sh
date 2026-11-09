#!/bin/sh
# Container entrypoint: ensure schema + seed defaults, then start the server.
set -e

echo "[boot] DATABASE_URL=${DATABASE_URL:-<unset>}"

echo "[boot] applying database schema (prisma db push)…"
prisma db push --schema prisma/schema.prisma --skip-generate || \
  echo "[boot] WARNING: db push failed — schema will be restored from the baked-in template"

echo "[boot] verifying/restoring database schema…"
node scripts/ensure-db.mjs || true

echo "[boot] seeding defaults if empty…"
node prisma/seed.boot.mjs || true

echo "[boot] starting server on port ${PORT:-8080}"
exec node server.js
