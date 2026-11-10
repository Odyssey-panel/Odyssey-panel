/**
 * Iran ISP presets for anti-censorship (TLS-fragment) settings.
 *
 * The fragment string follows the Marzban/xray convention
 * "<length>,<interval>,<packets>" (e.g. "100-200,20-30,tlshello").
 * Baseline values come from the Hiddify/Streisand community guides
 * (tlshello / 100-200 / 10-20, tcp "1-3" mode for some ISPs) — every
 * value is an editable default, not a hard guarantee: admins tune them.
 */

export type IspPreset = {
  id: string
  name: string // Persian name
  nameEn: string
  note: string // Persian guidance
  packets: string // tlshello | 1-3
  length: string // "100-200"
  interval: string // "10-20"
  port: string // recommended port
  transport: string // recommended transport
  sni: string // recommended SNI
}

function frag(p: IspPreset): string {
  return `${p.length},${p.interval},${p.packets}`
}

export const ISP_PRESETS: IspPreset[] = [
  {
    id: 'tci-fiber',
    name: 'فیبر نوری مخابرات',
    nameEn: 'TCI Fiber',
    note: 'سرعت بالا و پایدار؛ معمولاً بدون فرگمنت هم وصل می‌شود. اگر قطع شد فرگمنت tlshello را روشن کن.',
    packets: 'tlshello',
    length: '100-200',
    interval: '10-20',
    port: '443',
    transport: 'ws',
    sni: 'www.speedtest.net',
  },
  {
    id: 'tci-adsl',
    name: 'ADSL مخابرات',
    nameEn: 'TCI ADSL',
    note: 'روی خطوط ADSL حالت تکه‌تکه‌کردن TCP (بسته‌های 1-3) معمولاً بهتر از tlshello جواب می‌دهد.',
    packets: '1-3',
    length: '50-100',
    interval: '10-20',
    port: '443',
    transport: 'ws',
    sni: 'www.speedtest.net',
  },
  {
    id: 'mci',
    name: 'همراه اول',
    nameEn: 'MCI / Hamrah-e Aval',
    note: 'پیش‌فرض tlshello با طول ۱۰۰ تا ۲۰۰. اگر وصل نشد، طول را ۱۰-۵۰ امتحان کن یا پورت ۲۰۵۳/۸۴۴۳ را تست کن.',
    packets: 'tlshello',
    length: '100-200',
    interval: '10-20',
    port: '443',
    transport: 'ws',
    sni: 'www.speedtest.net',
  },
  {
    id: 'irancell',
    name: 'ایرانسل',
    nameEn: 'Irancell',
    note: 'tlshello پیش‌فرض؛ در ساعات شلوغی بازه طول را بزرگ‌تر کن (مثلاً ۱۰۰-۴۰۰) یا به 1-3 سوئیچ کن.',
    packets: 'tlshello',
    length: '100-200',
    interval: '10-20',
    port: '443',
    transport: 'ws',
    sni: 'www.speedtest.net',
  },
  {
    id: 'rightel',
    name: 'رایتل',
    nameEn: 'Rightel',
    note: 'همان خط پایه tlshello؛ فاصله بین فرگمنت‌ها را می‌توانی 10-30 بگذاری.',
    packets: 'tlshello',
    length: '100-200',
    interval: '10-30',
    port: '443',
    transport: 'ws',
    sni: 'www.speedtest.net',
  },
  {
    id: 'shatel',
    name: 'شاتل',
    nameEn: 'Shatel',
    note: 'روی شاتل ترافیک CDN معمولاً باز است؛ اول بدون فرگمنت تست کن، بعد tlshello.',
    packets: 'tlshello',
    length: '100-200',
    interval: '10-20',
    port: '443',
    transport: 'ws',
    sni: 'www.speedtest.net',
  },
]

export function ispFragment(p: IspPreset): string {
  return frag(p)
}

/** Merge saved admin overrides on top of the shipped defaults. */
export function mergeIspOverrides(saved: Record<string, Partial<IspPreset>> | null | undefined): IspPreset[] {
  if (!saved) return ISP_PRESETS
  return ISP_PRESETS.map((isp) => ({ ...isp, ...(saved[isp.id] || {}) }))
}
