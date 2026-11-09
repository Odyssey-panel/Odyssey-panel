import { requireAuth, jsonSafe } from '@/lib/auth'
import { tcpCheck, tlsCheck, httpProbe, TLS_PORTS } from '@/lib/health'

export const runtime = 'nodejs'

type ScanBody = {
  host?: string
  ports?: string // "443, 2053, 8000-8010"
  sni?: string
  timeoutMs?: number
}

export type ScanResult = {
  port: number
  tcp: { open: boolean; latencyMs?: number; error?: string }
  tls?: {
    ok: boolean
    latencyMs?: number
    error?: string
    subject?: string
    issuer?: string
    validFrom?: string
    validTo?: string
    daysLeft?: number
    sans?: string[]
    authorized?: boolean
  }
  http?: { ok: boolean; latencyMs?: number; httpStatus?: number; title?: string; server?: string; error?: string }
}

function parsePorts(spec: string): number[] {
  const out = new Set<number>()
  for (const part of spec.split(/[,;\s]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y)
      for (let p = a; p <= b && out.size < 64; p++) if (p >= 1 && p <= 65535) out.add(p)
    } else {
      const p = Number(part)
      if (Number.isInteger(p) && p >= 1 && p <= 65535) out.add(p)
    }
    if (out.size >= 64) break
  }
  return [...out].sort((a, b) => a - b).slice(0, 64)
}

function resolveHost(host: string): string {
  return host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const body = (await req.json().catch(() => ({}))) as ScanBody
  const host = resolveHost(body.host || '')
  if (!host || !/^[a-z0-9.\-]+(\.[a-z0-9\-]+)*$/i.test(host) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return Response.json({ error: 'Valid host or IP required' }, { status: 400 })
  }
  const ports = parsePorts(body.ports || '443')
  if (!ports.length) return Response.json({ error: 'No valid ports given' }, { status: 400 })
  const sni = (body.sni || '').trim() || null
  const timeout = Math.min(Math.max(Number(body.timeoutMs) || 4000, 1000), 10000)

  const results: ScanResult[] = []
  for (const port of ports) {
    const tcp = await tcpCheck(host, port, timeout)
    const item: ScanResult = { port, tcp: { open: tcp.ok, latencyMs: tcp.latencyMs, error: tcp.error } }
    if (tcp.ok) {
      // TLS probe: TLS-ish ports, or when the user provided an SNI
      if (TLS_PORTS.has(port) || sni || port === 5228 || port === 5222) {
        const tlsRes = await tlsCheck(host, port, sni || host, timeout)
        if (tlsRes.ok && tlsRes.cert) {
          item.tls = {
            ok: true,
            latencyMs: tlsRes.latencyMs,
            subject: tlsRes.cert.subject,
            issuer: tlsRes.cert.issuer,
            validFrom: tlsRes.cert.validFrom,
            validTo: tlsRes.cert.validTo,
            daysLeft: tlsRes.cert.daysLeft,
            sans: tlsRes.cert.sans.slice(0, 20),
            authorized: tlsRes.cert.authorized,
          }
          const http = await httpProbe(host, port, true, sni || host, timeout)
          item.http = http
        } else if (port === 80 || port === 8080) {
          // plain HTTP fallback
          item.http = await httpProbe(host, port, false, undefined, timeout)
        } else {
          item.tls = { ok: false, error: tlsRes.error }
        }
      } else if (port === 80 || port === 8080 || port === 8000 || port === 3000) {
        item.http = await httpProbe(host, port, false, undefined, timeout)
      }
    }
    results.push(item)
  }

  return jsonSafe({ host, sni, scannedAt: new Date().toISOString(), results })
}
