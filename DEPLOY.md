# اودیسه پنل — راهنمای دیپلوی / Deployment Guide

**فارسی:** پنل سلف‌هاست برای مدیریت کاربران پروکسی و اشتراک — SQLite داخلی (بدون دیتابیس خارجی)، لینک اشتراک + QR، بررسی سلامت نودها/ورکرها، اسکنر پورت. فارسی پیش‌فرض با سوییچ انگلیسی و دو چیدمان موبایل/دسکتاپ.

**English:** self-hosted proxy/subscription control panel — local SQLite, subscription links + QR, node/worker health checks, port scanner. Persian by default with an English switch and two layouts (desktop sidebar / mobile bottom-nav).

| Feature | Where |
| --- | --- |
| Dashboard: active users, nodes online, workers, proxy accounts, traffic | `/` → Dashboard |
| Users: traffic limits, expiry, enable/disable, reset traffic, +30 days | Users |
| Proxy accounts (vless / vmess / trojan / shadowsocks), share links, server config export, secret rotation | Users → Manage |
| Subscription endpoint: base64 (v2rayNG/Nekobox/Streisand), Clash, sing-box, raw | `GET /api/sub/<token>[?format=clash|singbox|raw]` |
| QR codes (client-side, always uses the current domain) | Users → QR |
| Node & worker health checks (TCP + TLS cert expiry + HTTP), auto every 5 min | Nodes & Workers |
| Scanner: IP/ports/SNI, certificate details, HTTP probe | Scanner |

Subscription links always work on any domain: the panel captures the origin you first manage it from and falls back gracefully — set `PANEL_PUBLIC_URL` to pin it explicitly.

---

## 🚄 دیپلوی روی Railway (پیشنهادی) / Deploy to Railway

1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → pick the repo. Railway detects `railway.json` and builds the Dockerfile.
3. Add persistence: service → **Volumes** → **Add Volume**, mount path `/data`.
4. Variables: `DATABASE_URL=file:/data/panel.db` (optional `PANEL_PUBLIC_URL=https://<your-domain>`).
5. Deploy. The container runs `prisma db push` + seeds defaults on every boot (`scripts/boot.sh`, idempotent — never overwrites your data) and listens on **8080**.
6. Open the Railway domain → login with `admin123` → **change the password in Settings**.

> بعد از اولین ورود روی دامنه نهایی، آدرس اشتراک‌ها خودکار همان دامنه می‌شود.

## 🐳 Docker مستقل / Standalone Docker

```bash
docker build -t odyssey-panel .
docker run -d --name odyssey-panel -p 8080:8080 \
  -v odyssey-data:/data \
  -e DATABASE_URL=file:/data/panel.db \
  odyssey-panel
```

یا / or: `docker compose up -d`

## 💻 اجرای لوکال / Local development

```bash
cp .env.example .env
npm install            # or bun install
npm run db:push
npm run seed           # default password admin123
npm run dev            # http://localhost:3000
npm run build && npm run start   # production on :8080
```

## 🔧 Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `file:/data/panel.db` | SQLite file (keep on a volume in production) |
| `PORT` | `8080` | HTTP port |
| `PANEL_PUBLIC_URL` | *(auto)* | Pin the base URL used in subscription links / QR |

Default admin password: `admin123` — change it in **Settings → Panel**. Sessions are HMAC-signed cookies valid for 12 hours.

## 💾 Backup

Everything lives in one SQLite file. Back up the volume file (`/data/panel.db`) — that's the whole state: users, proxies, nodes, settings.
