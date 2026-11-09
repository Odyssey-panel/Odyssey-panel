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
# generate prisma client + create db schema at build time
RUN npx prisma generate
ENV DATABASE_URL=file:/tmp/build.db
RUN mkdir -p /tmp && npx prisma db push --skip-generate || true
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

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/scripts/boot.sh ./scripts/boot.sh

# Persistent data directory (attach a Railway volume at /data in the dashboard)
RUN mkdir -p /data && chown -R panel:nodejs /data /app
EXPOSE 8080

# Railway mounts volumes as root:root — start as root to fix ownership,
# then drop to the unprivileged 'panel' user before starting the server.
CMD ["sh", "-c", "chown -R panel:nodejs /data 2>/dev/null || true; exec su-exec panel:nodejs sh scripts/boot.sh"]
