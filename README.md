# اودیسه پنل · Odyssey Panel

<p align="center">
  <b>فارسی</b> · <a href="#english">English</a>
</p>

پنل مدیریت **رایگان** و سلف‌هاست برای پروکسی و اشتراک — ساخته‌شده با Next.js 16 + Prisma + SQLite.

- 🇮🇷 **فارسی پیش‌فرض** (راست‌به‌چپ) با فونت وزیرمتن + سوییچ انگلیسی در هر لحظه
- 🖥️📱 **دو چیدمان**: دسکتاپ با منوی کناری، موبایل با منوی پایین — انتخاب خودکار
- 👥 **کاربران**: محدودیت ترافیک، تاریخ انقضا، فعال/غیرفعال، یادداشت
- 🔗 **اشتراک**: لینک + QR، فرمت‌های `base64 / raw / clash / sing-box`
- 🧩 **حساب‌های پروکسی**: VLESS / VMess / Trojan / Shadowsocks با UUID/رمز خودکار
- 🩺 **نودها و ورکرها**: بررسی سلامت TCP / TLS / HTTP + ردیابی انقضای گواهی (هر ۵ دقیقه خودکار)
- 🛰️ **اسکنر**: پورت، TLS/SNI و اطلاعات HTTP
- 🔐 ورود با رمز (سشن امضاشده HMAC، ۱۲ ساعته)

> ⚠️ ربات تلگرام و بخش فروش از این نسخه حذف شده است — پنل کاملاً شخصی است.

## اجرای لوکال

```bash
cp .env.example .env        # DATABASE_URL را تنظیم کنید
bun install                 # یا npm install
bun run db:push             # ساخت جداول
bun run seed                # رمز پیش‌فرض admin123 + نود نمونه
bun run dev                 # http://localhost:3000
```

رمز پیش‌فرض: `admin123` — بعد از اولین ورود از **تنظیمات** عوضش کنید.

## دیپلوی روی Railway

1. این ریپو را روی GitHub بگذارید (push کنید).
2. در Railway: **New Project → Deploy from GitHub repo**.
3. یک volume در مسیر `/data` اضافه کنید و متغیرها:
   - `DATABASE_URL=file:/data/panel.db`
4. تمام! کنتینر خودش `prisma db push` + seed را اجرا می‌کند (اسکریپت `scripts/boot.sh`) و روی پورت 8080 بالا می‌آید.

دستور Docker مستقل (بدون Railway):

```bash
docker build -t odyssey-panel .
docker run -p 8080:8080 -v odyssey-data:/data odyssey-panel
```

## ساختار پروژه

```
src/app/            صفحه پنل + API (auth, admin, sub)
src/components/panel/  UI پنل (دو چیدمان موبایل/دسکتاپ)
src/lib/            i18n (فارسی/انگلیسی), auth, health, links, format
prisma/             اسکیمای SQLite + seed
scripts/boot.sh     ورودِ کانتینر (db push + seed + start)
```

---

<a name="english"></a>

## English

A **free**, self-hosted proxy & subscription control panel — Next.js 16 + Prisma + SQLite.

- 🇮🇷 **Persian by default** (RTL, Vazirmatn font) with an instant English switch
- 🖥️📱 **Two layouts**: desktop sidebar on computers, bottom navigation on phones — chosen automatically
- 👥 **Users**: traffic limits, expiry dates, enable/disable, notes
- 🔗 **Subscriptions**: link + QR with `base64 / raw / clash / sing-box` formats
- 🧩 **Proxy accounts**: VLESS / VMess / Trojan / Shadowsocks with auto UUID/password
- 🩺 **Nodes & workers**: TCP/TLS/HTTP health checks + certificate expiry tracking (auto every 5 min)
- 🛰️ **Scanner**: ports, TLS/SNI, basic HTTP info
- 🔐 Password login (HMAC-signed session, 12h)

> ⚠️ The Telegram bot / sales flow was removed by design — this is a personal panel.

### Local

```bash
cp .env.example .env
bun install          # or npm install
bun run db:push
bun run seed         # default password admin123 + example node
bun run dev          # http://localhost:3000
```

### Railway

1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo**.
3. Add a volume mounted at `/data` and set `DATABASE_URL=file:/data/panel.db`.
4. Done — the container runs `prisma db push` + seed on boot (`scripts/boot.sh`) and serves on port 8080.

Default password: `admin123` — change it in **Settings** after first login.

## License

MIT — see [LICENSE](LICENSE).
