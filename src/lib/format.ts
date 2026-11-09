export const GB = 1024 ** 3

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i >= 2 ? digits : 0)} ${units[i]}`
}

export function gbToBytes(gb: number): number {
  return Math.round(gb * GB)
}

export function bytesToGb(bytes: number): number {
  return Math.round((bytes / GB) * 100) / 100
}

export function daysLeft(expiresAt: string | Date | null | undefined): number | null {
  if (!expiresAt) return null
  const t = new Date(expiresAt).getTime()
  if (!Number.isFinite(t)) return null
  return Math.ceil((t - Date.now()) / 86400000)
}

function localeFor(lang?: string): string | undefined {
  return lang === 'fa' ? 'fa-IR-u-ca-persian' : undefined
}

export function formatDate(d: string | Date | null | undefined, lang?: string): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(localeFor(lang), { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(d: string | Date | null | undefined, lang?: string): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString(localeFor(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function trafficState(
  usedBytes: number,
  limitBytes: number,
  status: string,
  expiresAt: string | null | undefined,
  lang = 'en'
): { label: string; kind: 'active' | 'expired' | 'exhausted' | 'disabled' } {
  const L = (en: string, fa: string) => (lang === 'fa' ? fa : en)
  if (status !== 'active') return { label: L('Disabled', 'غیرفعال'), kind: 'disabled' }
  const dl = daysLeft(expiresAt)
  if (dl !== null && dl <= 0) return { label: L('Expired', 'منقضی'), kind: 'expired' }
  if (limitBytes > 0 && usedBytes >= limitBytes) return { label: L('Exhausted', 'اتمام ترافیک'), kind: 'exhausted' }
  return { label: L('Active', 'فعال'), kind: 'active' }
}
