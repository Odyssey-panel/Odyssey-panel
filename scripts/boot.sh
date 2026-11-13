#!/bin/sh
# Container entrypoint: ensure schema + seed defaults, then start the server.
set -e

echo "[boot] DATABASE_URL=${DATABASE_URL:-<unset>}"

# ── sanitize DATABASE_URL ────────────────────────────────────────────────────
# This panel uses SQLite, so DATABASE_URL must be an absolute `file:` URL
# (image default: file:/data/panel.db). A plain path like `data/` or `/data`
# entered in the Railway Variables tab breaks Prisma with
# "the URL must start with the protocol file" — recover automatically:
# (ODYSSEY_DEFAULT_DB exists only as a test hook; production keeps /data/panel.db)
DEFAULT_DB="${ODYSSEY_DEFAULT_DB:-file:/data/panel.db}"
case "${DATABASE_URL:-}" in
  file:/*)
    p="${DATABASE_URL#file:}"
    p="${p%/}"
    if [ -d "$p" ]; then
      echo "[boot] NOTE: DATABASE_URL points at a directory — using $p/panel.db"
      DATABASE_URL="file:$p/panel.db"
    fi
    ;;
  file:*)
    echo "[boot] NOTE: DATABASE_URL is a relative path — using default $DEFAULT_DB"
    DATABASE_URL="$DEFAULT_DB"
    ;;
  "")
    echo "[boot] NOTE: DATABASE_URL is unset — using default $DEFAULT_DB"
    DATABASE_URL="$DEFAULT_DB"
    ;;
  *)
    echo "[boot] NOTE: DATABASE_URL must start with 'file:' (got '$DATABASE_URL') — using default $DEFAULT_DB"
    DATABASE_URL="$DEFAULT_DB"
    ;;
esac
export DATABASE_URL

# ── first boot: seed the live database from the repo-baked copy ─────────────
# db/custom.db ships inside the image (schema + branded defaults + the admin
# password + a stable panelSecret). When the data directory is empty — fresh
# deploy, or no volume attached yet — start from it so the panel works the
# moment it deploys. An existing non-empty database is never overwritten.
SEED_DB="db/custom.db"
DB_PATH="${DATABASE_URL#file:}"
if [ -s "$SEED_DB" ] && [ ! -s "$DB_PATH" ]; then
  mkdir -p "$(dirname "$DB_PATH")"
  cp "$SEED_DB" "$DB_PATH"
  echo "[boot] first boot — live database seeded from the baked-in repo db"
fi

echo "[boot] applying database schema (prisma db push)…"
prisma db push --schema prisma/schema.prisma --skip-generate || \
  echo "[boot] WARNING: db push failed — schema will be restored from the baked-in template"

echo "[boot] verifying/restoring database schema…"
node scripts/ensure-db.mjs || true

echo "[boot] seeding defaults if empty…"
node prisma/seed.boot.mjs || true

echo "[boot] repairing URL-pasted addresses (one-time normalization)…"
node scripts/migrate-addresses.mjs || true

echo "[boot] enforcing the Odyssey- prefix on every config name…"
node scripts/migrate-remarks.mjs || true

echo "[boot] preparing built-in backend (xray config)…"
node scripts/xray-sync.mjs --config-only || true

echo "[boot] starting edge router on port ${PORT:-8080} (next:8081 · xray-ws:/vlessws)"
exec node scripts/edge.js
