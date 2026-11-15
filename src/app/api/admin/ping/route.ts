import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

function isPublicIp(address: string): boolean {
  const version = net.isIP(address)
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2) || (b === 88 && c === 99))) return false
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
    if (a === 203 && b === 0 && c === 113) return false
    return true
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    const first = Number.parseInt(normalized.split(':')[0] || '0', 16)
    // Only globally-routable unicast space; reject ULA, link-local,
    // loopback, mapped IPv4, multicast and documentation ranges.
    if (first < 0x2000 || first > 0x3fff) return false
    if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0:')) return false
    return true
  }
  return false
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const body = (await req.json().catch(() => ({}))) as { host?: string; port?: number }
  const host = (body.host || '').trim().replace(/^\[|\]$/g, '')
  const port = Number(body.port)

  if (!host || host.length > 253 || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Response.json({ error: 'Valid host and port required' }, { status: 400 })
  }

  try {
    const addresses = net.isIP(host)
      ? [{ address: host, family: net.isIP(host) }]
      : await lookup(host, { all: true, verbatim: true })

    if (!addresses.length || addresses.some((item) => !isPublicIp(item.address))) {
      return Response.json({ error: 'Private or non-public destinations are not allowed' }, { status: 400 })
    }

    const target = addresses[0]
    const started = Date.now()
    const latencyMs = await new Promise<number>((resolve, reject) => {
      const socket = net.createConnection({ host: target.address, port, family: target.family })
      const timer = setTimeout(() => {
        socket.destroy()
        reject(new Error('Connection timed out'))
      }, 2500)
      socket.once('connect', () => {
        clearTimeout(timer)
        const elapsed = Date.now() - started
        socket.destroy()
        resolve(elapsed)
      })
      socket.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
    })

    return Response.json({ ok: true, latencyMs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ping failed'
    return Response.json({ error: message }, { status: 502 })
  }
}
