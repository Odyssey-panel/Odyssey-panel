/**
 * Simple health checks: raw TCP connect, TLS handshake (certificate details),
 * HTTP probe, plus DB-backed node/worker check orchestration.
 */
import net from 'node:net'
import tls from 'node:tls'
import { db } from '@/lib/db'

export type TcpResult = { ok: boolean; latencyMs?: number; error?: string }
export type TlsResult = {
  ok: boolean
  latencyMs?: number
  cert?: {
    subject: string
    issuer: string
    validFrom: string
    validTo: string
    daysLeft: number
    sans: string[]
    authorized: boolean
  }
  error?: string
}
export type HttpResult = { ok: boolean; latencyMs?: number; httpStatus?: number; title?: string; server?: string; error?: string }

export function tcpCheck(host: string, port: number, timeout = 4000): Promise<TcpResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()
    let done = false
    const finish = (r: TcpResult) => {
      if (!done) {
        done = true
        socket.destroy()
        resolve(r)
      }
    }
    socket.setTimeout(timeout)
    socket.once('connect', () => finish({ ok: true, latencyMs: Date.now() - start }))
    socket.once('timeout', () => finish({ ok: false, error: `timeout after ${timeout}ms` }))
    socket.once('error', (e) => finish({ ok: false, error: e.message }))
    socket.connect(port, host)
  })
}

export function tlsCheck(host: string, port: number, sni?: string | null, timeout = 5000): Promise<TlsResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    let done = false
    const finish = (r: TlsResult) => {
      if (!done) {
        done = true
        try {
          socket.destroy()
        } catch {}
        resolve(r)
      }
    }
    const socket = tls.connect(
      {
        host,
        port,
        servername: sni || host,
        rejectUnauthorized: false, // we want the cert even when self-signed
      },
      () => {
        try {
          const cert = socket.getPeerCertificate()
          const validTo = cert?.valid_to ? new Date(cert.valid_to) : null
          const sans = cert?.subjectaltname
            ? cert.subjectaltname
                .split(',')
                .map((s) => s.trim().replace(/^(DNS|IP Address):/i, ''))
                .filter(Boolean)
            : []
          finish({
            ok: true,
            latencyMs: Date.now() - start,
            cert: {
              subject: cert?.subject?.CN || host,
              issuer: cert?.issuer?.O || cert?.issuer?.CN || 'unknown',
              validFrom: cert?.valid_from ? new Date(cert.valid_from).toISOString() : '',
              validTo: validTo ? validTo.toISOString() : '',
              daysLeft: validTo ? Math.ceil((validTo.getTime() - Date.now()) / 86400000) : -1,
              sans,
              authorized: socket.authorized,
            },
          })
        } catch (e) {
          finish({ ok: false, error: `handshake ok but cert parse failed: ${e}` })
        }
      }
    )
    socket.setTimeout(timeout)
    socket.once('timeout', () => finish({ ok: false, error: `tls timeout after ${timeout}ms` }))
    socket.once('error', (e) => finish({ ok: false, error: e.message }))
  })
}

const TLS_PORTS = new Set([443, 2053, 2083, 2087, 2096, 8443, 8880 + 3])

export async function httpProbe(host: string, port: number, useTls: boolean, sniHint?: string, timeout = 4000): Promise<HttpResult> {
  const scheme = useTls ? 'https' : 'http'
  const hostPart = /:/.test(host) && !host.startsWith('[') ? `[${host}]` : host
  const url = `${scheme}://${hostPart}:${port}/`
  const start = Date.now()
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; PanelScanner/1.0)' },
    })
    let title: string | undefined
    let server: string | undefined
    try {
      const text = await res.text()
      const m = text.match(/<title[^>]*>([^<]{0,200})<\/title>/i)
      if (m) title = m[1].trim()
      server = res.headers.get('server') || undefined
    } catch {}
    return { ok: res.status < 500, latencyMs: Date.now() - start, httpStatus: res.status, title, server }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Check a Node row: TCP + (optional) TLS cert, persist status. */
export async function checkNodeById(id: string) {
  const node = await db.node.findUnique({ where: { id } })
  if (!node) return null
  const tcp = await tcpCheck(node.address, node.port)
  let certExpiresAt: Date | null | undefined = undefined
  let latency = tcp.latencyMs
  if (tcp.ok && node.tls) {
    const tlsRes = await tlsCheck(node.address, node.port, node.sni || node.address)
    if (tlsRes.ok && tlsRes.cert) certExpiresAt = tlsRes.cert.validTo ? new Date(tlsRes.cert.validTo) : null
    if (tlsRes.ok) latency = tlsRes.latencyMs ?? latency
  }
  const updated = await db.node.update({
    where: { id },
    data: {
      status: tcp.ok ? 'up' : 'down',
      latencyMs: tcp.ok ? latency ?? null : null,
      certExpiresAt: certExpiresAt === undefined ? node.certExpiresAt : certExpiresAt,
      lastCheckedAt: new Date(),
    },
  })
  return updated
}

/** Check a Worker row via HTTP GET, persist status. */
export async function checkWorkerById(id: string) {
  const worker = await db.worker.findUnique({ where: { id } })
  if (!worker) return null
  const start = Date.now()
  let status = 'down'
  let httpStatus: number | null = null
  let latencyMs: number | null = null
  try {
    const res = await fetch(worker.url, {
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; PanelWorkerCheck/1.0)' },
    })
    httpStatus = res.status
    latencyMs = Date.now() - start
    status = res.ok ? 'up' : 'down'
  } catch {
    status = 'down'
  }
  return db.worker.update({
    where: { id },
    data: { status, httpStatus, latencyMs, lastCheckedAt: new Date() },
  })
}

export async function checkAllNodes() {
  const nodes = await db.node.findMany({ select: { id: true } })
  const results = await Promise.allSettled(nodes.map((n) => checkNodeById(n.id)))
  return results.length
}

export async function checkAllWorkers() {
  const workers = await db.worker.findMany({ select: { id: true } })
  const results = await Promise.allSettled(workers.map((w) => checkWorkerById(w.id)))
  return results.length
}

export { TLS_PORTS }
