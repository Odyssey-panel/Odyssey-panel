'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Lang = 'fa' | 'en'

/**
 * Persian dictionary. Keys are the English source strings — anything missing
 * gracefully falls back to the English text.
 */
const FA: Record<string, string> = {
  // ── Shell / navigation ───────────────────────────────────────────────
  'Odyssey Panel': 'اودیسه',
  'User created — no server address given, so no proxy account was generated':
    'کاربر ساخته شد — چون آدرس سرور ندادی، کانفیگی ساخته نشد؛ بعداً از مدیریت کاربر اضافه کن',
  'Personal proxy control center': 'مرکز کنترل شخصی پروکسی',
  Free: 'رایگان',
  'Free forever': 'همیشه رایگان',
  Dashboard: 'داشبورد',
  Users: 'کاربران',
  'Nodes & Workers': 'نودها و ورکرها',
  Scanner: 'اسکنر',
  Settings: 'تنظیمات',
  Menu: 'منو',
  Navigation: 'ناوبری',
  'Open menu': 'باز کردن منو',
  Language: 'زبان',
  Persian: 'فارسی',
  English: 'انگلیسی',
  'Dark mode': 'حالت روشن',
  'Light mode': 'حالت تاریک',
  'Sign out': 'خروج',
  Admin: 'مدیر',
  'Full access': 'دسترسی کامل',
  'Loading panel…': 'در حال بارگذاری پنل…',
  'Free · self-hosted · works on any domain': 'رایگان · سلف‌هاست · روی هر دامنه‌ای کار می‌کند',
  'Two layouts: this is the {device} view': 'دو چیدمان داریم: این نمای {device} است',
  desktop: 'دسکتاپ',
  mobile: 'موبایل',

  // ── Login ────────────────────────────────────────────────────────────
  'Welcome back': 'خوش برگشتی',
  'Sign in to manage users, nodes and subscription links': 'برای مدیریت کاربران، نودها و لینک‌های اشتراک وارد شو',
  'Admin password': 'رمز مدیر',
  'Sign in': 'ورود',
  'Signing in…': 'در حال ورود…',
  'Hello, sir 👋': 'سلام رئیس 👋',
  'Welcome back to your control panel': 'به پنل مدیریت خودت برگشتی',
  'Login failed': 'ورود ناموفق بود',
  'Default password is': 'رمز پیش‌فرض',
  '— change it in Settings.': '— بعداً از تنظیمات عوضش کن.',
  'self-hosted proxy & subscription panel': 'پنل سلف‌هاست پروکسی و اشتراک',
  'Manage users, traffic limits and subscription links — completely free, on your own domain.':
    'مدیریت کاربران، محدودیت ترافیک و لینک‌های اشتراک — کاملاً رایگان، روی دامنه خودت.',

  // ── Dashboard ────────────────────────────────────────────────────────
  Overview: 'نمای کلی',
  'Here’s what’s happening with your network today.': 'امروز شبکه‌ات در چه وضعیتی است.',
  Refresh: 'به‌روزرسانی',
  'New user': 'کاربر جدید',
  'Active users': 'کاربران فعال',
  expired: 'منقضی',
  disabled: 'غیرفعال',
  'Nodes online': 'نودهای آنلاین',
  avg: 'میانگین',
  'run a health check': 'بررسی سلامت اجرا کن',
  'Workers online': 'ورکرهای آنلاین',
  'Cloudflare workers & endpoints': 'ورکرهای کلادفلر و اندپوینت‌ها',
  'Proxy accounts': 'حساب‌های پروکسی',
  'all proxy accounts': 'همه حساب‌های پروکسی',
  'Traffic allocation': 'ترافیک تخصیص‌یافته',
  'Sum across all users': 'مجموع روی همه کاربران',
  used: 'مصرف‌شده',
  of: 'از',
  'limits not set': 'محدودیتی تعیین نشده',
  'Nodes healthy': 'نودهای سالم',
  Subscriptions: 'اشتراک‌ها',
  'Panel URL': 'آدرس پنل',
  'Base URL used in subscription links & QR codes': 'آدرس پایه‌ای که در لینک اشتراک و QR استفاده می‌شود',
  'Not detected yet — open the panel once, or set it in Settings':
    'هنوز شناسایی نشده — یک بار پنل را باز کن یا در تنظیمات واردش کن',
  'Subscription links are relative paths under this origin, so they keep working after you move the deployment to its final domain. You can also pin an explicit URL in Settings.':
    'لینک‌های اشتراک مسیرهایی نسبی روی همین دامنه‌اند؛ پس بعد از انتقال به دامنه نهایی هم کار می‌کنند. می‌توانی یک آدرس ثابت هم در تنظیمات تعیین کنی.',
  'Open scanner': 'باز کردن اسکنر',
  'Go to settings': 'برو به تنظیمات',
  'Tip: after deploying to your final domain, the URL is auto-detected the first time you sign in.':
    'نکته: بعد از دیپلوی روی دامنه نهایی، آدرس در اولین ورود خودکار شناسایی می‌شود.',
  'Quick actions': 'کارهای سریع',
  'Create a user, check your servers or scan a host — everything from one place.':
    'ساخت کاربر، بررسی سرورها یا اسکن یک هاست — همه‌چیز از یک‌جا.',
  'Check nodes': 'بررسی نودها',
  'Add node': 'افزودن نود',

  // ── Users / clients ──────────────────────────────────────────────────
  Subscribers: 'مشترکین',
  'Subscribers, traffic limits, expiry and subscription links':
    'مشترکین، محدودیت ترافیک، انقضا و لینک اشتراک',
  'Search by name or note…': 'جستجو با نام یا یادداشت…',
  'Search users': 'جستجوی کاربران',
  'No users yet. Create your first user to generate proxy accounts and a subscription link.':
    'هنوز کاربری نیست. اولین کاربر را بساز تا حساب پروکسی و لینک اشتراک ساخته شود.',
  accounts: 'حساب',
  'used · unlimited': 'مصرف‌شده · نامحدود',
  'expires in {d} days ({date})': 'منقضی می‌شود تا {d} روز دیگر ({date})',
  'expired {date}': 'منقضی شده در {date}',
  'no expiry': 'بدون انقضا',
  'expires in': 'انقضا تا',
  days: 'روز',
  QR: 'QR',
  'Sub link': 'لینک اشتراک',
  Manage: 'مدیریت',
  'Delete user “{name}”?': 'حذف کاربر «{name}»؟',
  'This permanently removes the user, all proxy accounts and revokes the subscription link.':
    'این کار کاربر و همه حساب‌های پروکسی را برای همیشه حذف می‌کند و لینک اشتراک را باطل می‌کند.',
  Cancel: 'انصراف',
  Delete: 'حذف',
  'User deleted': 'کاربر حذف شد',
  'Open details for {name}': 'باز کردن جزئیات {name}',
  'Delete {name}': 'حذف {name}',

  // Create dialog
  'Name is required': 'نام الزامی است',
  'User created — subscription link ready': 'کاربر ساخته شد — لینک اشتراک آماده است',
  'Create failed': 'ساخت ناموفق بود',
  'Creates a subscriber with a unique subscription token. Optionally generate the first proxy account.':
    'یک مشترک با توکن اشتراک یکتا می‌سازد. می‌توانی اولین حساب پروکسی را هم همین‌جا بسازی.',
  'Name *': 'نام *',
  'Traffic limit (GB, 0 = unlimited)': 'محدودیت ترافیک (گیگابایت، صفر = نامحدود)',
  'Valid for (days, 0 = never)': 'اعتبار (روز، صفر = همیشه)',
  Note: 'یادداشت',
  'friend, family, …': 'دوست، خانواده، …',
  'Generate proxy account now': 'ساخت فوری حساب پروکسی',
  'VLESS/VMess get a UUID; Trojan/SS get a password': 'به VLESS/VMess یک UUID و به Trojan/SS یک رمز داده می‌شود',
  Protocol: 'پروتکل',
  'Server address / IP *': 'آدرس سرور / IP *',
  'Port *': 'پورت *',
  'SNI / domain': 'SNI / دامنه',
  Transport: 'ترنسپورت',
  'Service name': 'نام سرویس',
  'WS path': 'مسیر WS',
  'Host header': 'هدر Host',
  optional: 'اختیاری',
  'Create user': 'ساخت کاربر',
  'same as address': 'همان آدرس',

  // Edit dialog
  'Edit user': 'ویرایش کاربر',
  'Traffic limit (GB)': 'محدودیت ترافیک (گیگابایت)',
  'Expires on': 'تاریخ انقضا',
  Status: 'وضعیت',
  active: 'فعال',
  Save: 'ذخیره',
  'User updated': 'کاربر به‌روزرسانی شد',
  'Update failed': 'به‌روزرسانی ناموفق بود',

  // Detail dialog
  'Subscription and proxy accounts — everything is served from the domain the panel currently runs on.':
    'اشتراک و حساب‌های پروکسی — همه‌چیز از دامنه‌ای که پنل روش اجراست سرو می‌شود.',
  Subscription: 'اشتراک',
  'Subscription link': 'لینک اشتراک',
  'Config address (vless://)': 'آدرس کانفیگ (vless://)',
  'No config yet — open Manage and add a proxy account to get its vless:// address':
    'هنوز کانفیگی ساخته نشده — از «مدیریت» یه حساب پروکسی با آدرس سرور اضافه کن تا آدرس vless:// اینجا نمایش داده بشه',
  'No config yet — add a proxy account (with a server address) and its vless:// address will appear here':
    'هنوز کانفیگی نیست — از دکمهٔ «افزودن حساب» با آدرس سرور بساز؛ آدرس vless:// بلافاصله همین‌جا میاد',
  'Show QR': 'نمایش QR',
  'Clash link': 'لینک Clash',
  'sing-box link': 'لینک sing-box',
  'Raw links': 'لینک‌های خام',
  Token: 'توکن',
  'Extended 30 days': '۳۰ روز تمدید شد',
  '+30 days': '+۳۰ روز',
  'Reset traffic': 'ریست ترافیک',
  'Traffic reset': 'ترافیک ریست شد',
  Disable: 'غیرفعال کردن',
  Enable: 'فعال کردن',
  'Health check started': 'بررسی سلامت شروع شد',
  'Proxy accounts ({n})': 'حساب‌های پروکسی ({n})',
  'No accounts yet — add one to populate the subscription.':
    'هنوز حسابی نیست — یکی اضافه کن تا اشتراک پر شود.',
  'TLS on': 'TLS روشن',
  'TLS off': 'TLS خاموش',
  Link: 'لینک',
  Secret: 'رمز',
  Config: 'کانفیگ',
  Rotate: 'چرخش رمز',
  'Secret rotated — old links stop working': 'رمز عوض شد — لینک‌های قبلی از کار می‌افتند',
  'Account removed': 'حساب حذف شد',
  'Delete account': 'حذف حساب',
  'Traffic & expiry': 'ترافیک و انقضا',
  Used: 'مصرف',
  Limit: 'محدودیت',
  Expires: 'انقضا',
  'Days left': 'روز باقی‌مانده',
  never: 'هرگز',
  unlimited: 'نامحدود',
  'Add account': 'افزودن حساب',
  'Add proxy account': 'افزودن حساب پروکسی',
  'A fresh UUID/password is generated on the server and stored locally.':
    'یک UUID/رمز تازه روی سرور ساخته و همین‌جا ذخیره می‌شود.',
  Remark: 'نام نمایشی',
  'Address *': 'آدرس *',
  SNI: 'SNI',
  Generate: 'ساخت',
  'Account generated': 'حساب ساخته شد',

  // ── Nodes & Workers ──────────────────────────────────────────────────
  Infrastructure: 'زیرساخت',
  'Backend servers and worker endpoints with simple TCP/TLS/HTTP health checks — auto-refreshed every 5 minutes':
    'سرورهای پشتی و اندپوینت‌های ورکر با بررسی سلامت TCP/TLS/HTTP — هر ۵ دقیقه خودکار به‌روز می‌شود',
  'Check all': 'بررسی همه',
  'Add worker': 'افزودن ورکر',
  'Nodes ({n})': 'نودها ({n})',
  'Workers ({n})': 'ورکرها ({n})',
  'No nodes yet. Add your VPS / inbound server to start tracking.':
    'هنوز نودی نیست. سرور VPS خودت را اضافه کن تا ردیابی شروع شود.',
  'No workers yet. Add a Cloudflare worker URL or any HTTP endpoint to monitor.':
    'هنوز ورکری نیست. آدرس یک ورکر کلادفلر یا هر اندپوینت HTTP اضافه کن.',
  plain: 'بدون TLS',
  'cert expires in {d}d': 'گواهی تا {d} روز دیگر منقضی می‌شود',
  'checked {time}': 'آخرین بررسی {time}',
  'never checked': 'هرگز بررسی نشده',
  Check: 'بررسی',
  Add: 'افزودن',
  '{name} checked': '{name} بررسی شد',
  'Running health checks…': 'در حال بررسی سلامت…',
  'Health checks complete': 'بررسی سلامت کامل شد',
  'Check failed': 'بررسی ناموفق بود',
  'Delete {kind} “{name}”?': 'حذف {kind} «{name}»؟',
  'Health tracking for this entry will be removed.': 'ردیابی سلامت این مورد حذف می‌شود.',
  Deleted: 'حذف شد',
  node: 'نود',
  worker: 'ورکر',
  'A backend server (VPS / inbound) to watch with TCP + TLS certificate checks.':
    'یک سرور پشتی (VPS / inbound) برای ردیابی با بررسی TCP و گواهی TLS.',
  'TLS enabled': 'TLS فعال',
  'enables certificate expiry tracking': 'ردیابی انقضای گواهی را فعال می‌کند',
  'Add & check later': 'افزودن (بعداً بررسی می‌شود)',
  'Node added': 'نود اضافه شد',
  'Edit node': 'ویرایش نود',
  'Node updated': 'نود به‌روزرسانی شد',
  'Cloudflare worker, subscription mirror, or any HTTP endpoint to monitor with GET requests.':
    'ورکر کلادفلر، آینه اشتراک یا هر اندپوینت HTTP برای ردیابی با درخواست GET.',
  'URL *': 'URL *',
  'Worker added': 'ورکر اضافه شد',
  'SNI (for TLS check)': 'SNI (برای بررسی TLS)',
  Location: 'موقعیت',

  // ── Scanner ──────────────────────────────────────────────────────────
  Diagnostics: 'عیب‌یابی',
  'Check IPs, ports, TLS/SNI and basic HTTP info. Tap any value to copy.':
    'بررسی IP، پورت‌ها، TLS/SNI و اطلاعات اولیه HTTP. روی هر مقدار بزن تا کپی شود.',
  Target: 'هدف',
  'Host / IP *': 'هاست / IP *',
  Ports: 'پورت‌ها',
  Scan: 'اسکن',
  'up to 64 ports per scan': 'حداکثر ۶۴ پورت در هر اسکن',
  'Quick fills': 'پرکردن سریع',
  'Enter a host or IP': 'یک هاست یا IP وارد کن',
  'Scanned {n} port(s)': '{n} پورت اسکن شد',
  'Scan failed': 'اسکن ناموفق بود',
  ports: 'پورت',
  'Copy all as text': 'کپی همه به‌صورت متن',
  'Copy JSON': 'کپی JSON',
  OPEN: 'باز',
  CLOSED: 'بسته',
  'TCP connection succeeded': 'اتصال TCP موفق بود',
  'TCP failed — {err}': 'اتصال TCP ناموفق — {err}',
  'no response': 'بدون پاسخ',
  'TLS / SNI': 'TLS / SNI',
  'valid chain': 'زنجیره معتبر',
  'self-signed / untrusted': 'سلف‌ساین / غیرقابل‌اعتماد',
  'handshake failed': 'دست‌دهی ناموفق',
  'Subject (CN)': 'موضوع (CN)',
  Issuer: 'صادرکننده',
  '{d}d left': '{d} روز مانده',
  'SANs (domains on cert)': 'SANها (دامنه‌های روی گواهی)',
  'Valid from': 'معتبر از',
  'Handshake latency': 'تأخیر دست‌دهی',
  'HTTP probe': 'تست HTTP',
  'Server header': 'هدر Server',
  'Page title': 'عنوان صفحه',
  'Hide raw': 'بستن خروجی خام',
  'Raw result': 'خروجی خام',
  'Copy summary': 'کپی خلاصه',
  'cloudflare 443': 'کلادفلر ۴۴۳',
  'CF clean ports': 'پورت‌های تمیز CF',
  'Scan of {host}': 'اسکن {host}',

  // ── Settings ─────────────────────────────────────────────────────────
  Configuration: 'پیکربندی',
  'Panel URL, admin password and appearance': 'آدرس پنل، رمز مدیر و ظاهر پنل',
  'Save changes': 'ذخیره تغییرات',
  Panel: 'پنل',
  'Public URL and admin credentials': 'آدرس عمومی و رمز مدیر',
  'Effective panel URL (auto-detected or pinned)': 'آدرس فعال پنل (خودکار یا دستی)',
  'not detected yet': 'هنوز شناسایی نشده',
  'Public URL override': 'آدرس عمومی دستی',
  'https://panel.example.com (leave empty to auto-detect)':
    'https://panel.example.com (خالی بگذار تا خودکار شناسایی شود)',
  'Used in subscription links and QR codes. Empty = auto-detected from the browser you manage the panel with, so it adapts to whatever domain you deploy on.':
    'در لینک‌های اشتراک و QR استفاده می‌شود. خالی = خودکار از مرورگری که پنل را با آن مدیریت می‌کنی؛ پس با هر دامنه‌ای سازگار می‌شود.',
  'Change admin password': 'تغییر رمز مدیر',
  'new password (min 6 chars)': 'رمز جدید (حداقل ۶ کاراکتر)',
  'Settings saved': 'تنظیمات ذخیره شد',
  'Save failed': 'ذخیره ناموفق بود',
  'Language & appearance': 'زبان و ظاهر',
  'Interface language': 'زبان رابط',
  'Persian (RTL)': 'فارسی (راست‌به‌چپ)',
  'English (LTR)': 'انگلیسی (چپ‌به‌راست)',
  'Switch anytime — the whole panel translates and mirrors instantly.':
    'هر وقت خواستی عوض کن — کل پنل همان لحظه ترجمه و قرینه می‌شود.',
  Theme: 'پوسته',
  Dark: 'تیره',
  Light: 'روشن',
  'Layout': 'چیدمان',
  'This panel ships with two layouts — desktop with a sidebar, and mobile with bottom navigation. It picks the right one automatically based on your screen.':
    'این پنل دو چیدمان دارد — دسکتاپ با منوی کناری و موبایل با منوی پایین. بسته به صفحه‌ات خودکار درست‌ترین را انتخاب می‌کند.',
  'Desktop layout': 'چیدمان دسکتاپ',
  'Mobile layout': 'چیدمان موبایل',
  'sidebar + full tables': 'منوی کناری + جدول کامل',
  'bottom navigation + compact cards': 'منوی پایین + کارت‌های جمع‌وجور',
  'Password must be at least 6 characters': 'رمز باید حداقل ۶ کاراکتر باشد',

  // ── Status badges ────────────────────────────────────────────────────
  Active: 'فعال',
  Expired: 'منقضی',
  Exhausted: 'اتمام ترافیک',
  up: 'آنلاین',
  down: 'آفلاین',
  unknown: 'نامشخص',

  // ── QR dialog ────────────────────────────────────────────────────────
  'Subscription QR': 'QR اشتراک',
  'QR — {name}': 'QR — {name}',
  'Scan it with v2rayNG, Nekobox, Streisand or any client that supports subscription QR.':
    'با v2rayNG، Nekobox، Streisand یا هر کلاینتی که QR اشتراک را پشتیبانی می‌کند اسکن کن.',

  // ── Copy / misc ──────────────────────────────────────────────────────
  Copy: 'کپی',
  'Copy link': 'کپی لینک',
  'Copy failed — long-press to copy manually': 'کپی نشد — برای کپی دستی نگه دار',
  'Copied': 'کپی شد',
  'Copied {label}': '{label} کپی شد',
  'Tap to copy': 'برای کپی بزن',
  Show: 'نمایش',
  Hide: 'مخفی',
  Unauthorized: 'دسترسی غیرمجاز',
  Failed: 'ناموفق بود',
  'Request failed': 'درخواست ناموفق بود',
  'Request failed ({status})': 'درخواست ناموفق بود ({status})',
}

type LangContextValue = {
  lang: Lang
  dir: 'rtl' | 'ltr'
  isFa: boolean
  setLang: (l: Lang) => void
  /** Translate a source string (with optional {placeholder} interpolation). */
  t: (s: string, vars?: Record<string, string | number>) => string
}

const LangContext = createContext<LangContextValue | null>(null)

const STORAGE_KEY = 'odyssey.lang'

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fa')

  // Restore the saved choice (script in layout.tsx already fixed <html> before paint).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'fa') setLangState(saved)
    } catch {}
  }, [])

  // Keep <html lang/dir> in sync.
  useEffect(() => {
    const el = document.documentElement
    el.lang = lang
    el.dir = lang === 'fa' ? 'rtl' : 'ltr'
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const t = useCallback(
    (s: string, vars?: Record<string, string | number>) => {
      let out = lang === 'fa' ? FA[s] ?? s : s
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replaceAll(`{${k}}`, String(v))
        }
      }
      return out
    },
    [lang]
  )

  const value = useMemo<LangContextValue>(
    () => ({ lang, dir: lang === 'fa' ? 'rtl' : 'ltr', isFa: lang === 'fa', setLang, t }),
    [lang, setLang, t]
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}
