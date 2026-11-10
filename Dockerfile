# ---- deps (bun + frozen lockfile = reproducible) ----
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# generate prisma client
RUN npx prisma generate
# bake a template database holding the complete schema — copied into the
# runtime image and used by scripts/ensure-db.mjs for runtime self-healing
ENV DATABASE_URL=file:/app/prisma/template.db
RUN npx prisma db push --skip-generate && rm -f /app/prisma/template.db-*
# build the app
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/panel.db

RUN apk add --no-cache openssl su-exec && addgroup -g 1001 -S nodejs && adduser -S panel -u 1001

# built-in VPN backend (xray-core): powers vless+ws on the panel's own domain
# under /vlessws so generated configs genuinely work with zero external setup
ADD https://github.com/XTLS/Xray-core/releases/download/v26.11.9/Xray-linux-64.zip /tmp/xray.zip
RUN apk add --no-cache unzip \
 && unzip -o /tmp/xray.zip xray -d /app/bin \
 && chmod +x /app/bin/xray \
 && rm -f /tmp/xray.zip \
 && apk del unzip

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/scripts/boot.sh ./scripts/boot.sh
COPY --from=builder /app/scripts/ensure-db.mjs ./scripts/ensure-db.mjs
COPY --from=builder /app/scripts/edge.js ./scripts/edge.js
COPY --from=builder /app/scripts/xray-sync.mjs ./scripts/xray-sync.mjs
COPY --from=builder /app/scripts/migrate-addresses.mjs ./scripts/migrate-addresses.mjs
# full prisma CLI (complete dependency tree incl. 'effect' etc.) so that
# `prisma db push` genuinely works at runtime for future schema upgrades
RUN npm install -g --no-audit --no-fund prisma@6.19.2

# Persistent data directory (attach a Railway volume at /data in the dashboard)
RUN mkdir -p /data && chown -R panel:nodejs /data /app
EXPOSE 8080

# Railway mounts volumes as root:root — start as root to fix ownership,
# then drop to the unprivileged 'panel' user before starting the server.
# HOME is pointed at /tmp so the unprivileged user never writes to
# root-owned cache directories.
CMD ["sh", "-c", "chown -R panel:nodejs /data 2>/dev/null || true; exec su-exec panel:nodejs env HOME=/tmp sh scripts/boot.sh"]
