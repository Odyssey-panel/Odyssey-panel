'use client'

/**
 * Device-side connectivity self-test — runs in the user's browser and proves
 * (or disproves) that a generated config can actually work FROM THIS DEVICE:
 *
 *   step 1  https   — is the panel origin reachable over HTTPS?
 *   step 2  ws      — does the WebSocket tunnel path accept an upgrade?
 *   step 3  tunnel  — does a real VLESS header over that WS carry data?
 *
 * The browser cannot open raw TCP, so the tunnel test uses the WebSocket
 * transport (exactly what the vless ws configs of the built-in backend use).
 * Everything is scoped to what a normal web page is allowed to do.
 */

export type TunnelTestTarget = {
  /** hostname or IP the client connects to (no brackets for IPv6) */
  address: string
  port: number
  /** path for ws transport */
  path?: string | null
  /** ignored by the browser (it always uses its own origin) but kept for display */
  sni?: string | null
  uuid: string
}

export type TunnelTestStep = {
  id: 'https' | 'ws' | 'tunnel'
  label: string
  state: 'running' | 'ok' | 'fail'
  latencyMs?: number
  error?: string
}

export type TunnelTestResult = {
  ok: boolean
  steps: TunnelTestStep[]
  /** one of: 'ok' | 'https-blocked' | 'ws-blocked' | 'tunnel-blocked' | 'bad-uri' */
  verdict: string
}

/** Parse a vless://…ws… URI into the fields the device test needs. */
export function parseVlessUri(uri: string): TunnelTestTarget | null {
  try {
    const u = new URL(uri.trim())
    if (u.protocol !== 'vless:') return null
    const uuid = u.username || (u.host.startsWith('@') ? '' : '')
    const id = uuid || decodeURIComponent(uri.split('//')[1]?.split('@')[0] || '')
    if (!id) return null
    const type = u.searchParams.get('type') || 'ws'
    const security = u.searchParams.get('security') || 'none'
    if (type !== 'ws' || security !== 'tls') return null
    const host = u.hostname
    const port = Number(u.port) || 443
    const path = u.searchParams.get('path') || '/'
    return { address: host, port, path, sni: u.searchParams.get('sni'), uuid: id }
  } catch {
    return null
  }
}

/** Wait for a WS to open within `ms`, else reject. */
function openWebSocket(url: string, ms: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket
    const timer = setTimeout(() => {
      try { ws?.close() } catch {}
      reject(new Error('timeout'))
    }, ms)
    try {
      ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
    } catch (e) {
      clearTimeout(timer)
      reject(e as Error)
      return
    }
    ws.onopen = () => { clearTimeout(timer); resolve(ws) }
    ws.onerror = () => {
      clearTimeout(timer)
      reject(new Error('ws-error'))
    }
    ws.onclose = (ev) => {
      clearTimeout(timer)
      reject(new Error(`ws-closed-${ev.code}`))
    }
  })
}

function uuidToBytes(id: string): Uint8Array {
  const hex = id.replace(/-/g, '')
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Build the raw VLESS request header + inner HTTP probe payload. */
function buildVlessPayload(t: TunnelTestTarget): Uint8Array {
  const addr = new TextEncoder().encode(t.address)
  const req = `GET / HTTP/1.1\r\nHost: ${t.address}\r\nUser-Agent: odyssey-selftest\r\nConnection: close\r\n\r\n`
  const payload = new TextEncoder().encode(req)
  const head = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 1 + addr.length)
  let o = 0
  head[o++] = 0 // version
  head.set(uuidToBytes(t.uuid), o); o += 16
  head[o++] = 0 // addons length
  head[o++] = 1 // command tcp
  head[o++] = (80 >> 8) & 0xff
  head[o++] = 80 & 0xff
  head[o++] = 2 // atype domain
  head[o++] = addr.length
  head.set(addr, o)
  const all = new Uint8Array(head.length + payload.length)
  all.set(head, 0)
  all.set(payload, head.length)
  return all
}

const HTTPS_TIMEOUT = 8000
const WS_TIMEOUT = 8000
const TUNNEL_TIMEOUT = 12000

/**
 * Full device test. `t.address` must be SAME-ORIGIN reachable over https (the
 * built-in backend always is — the config rides the panel's own domain).
 */
export async function runDeviceTest(t: TunnelTestTarget): Promise<TunnelTestResult> {
  const steps: TunnelTestStep[] = []
  const fail = (verdict: string, idx: number, error: string, latency?: number): TunnelTestResult => {
    steps[idx] = { ...steps[idx], state: 'fail', error, latencyMs: latency }
    return { ok: false, steps, verdict }
  }

  // ── step 1: https reachability ───────────────────────────────────────────
  steps.push({ id: 'https', label: 'HTTPS', state: 'running' })
  const t0 = Date.now()
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), HTTPS_TIMEOUT)
    await fetch('/api/auth/me', { method: 'GET', cache: 'no-store', signal: ac.signal })
    clearTimeout(timer)
    steps[0] = { id: 'https', label: 'HTTPS', state: 'ok', latencyMs: Date.now() - t0 }
  } catch {
    return fail('https-blocked', 0, 'unreachable')
  }

  // ── step 2 + 3: ws upgrade + real tunnel ────────────────────────────────
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const hostPart = t.address.includes(':') ? `[${t.address}]` : t.address
  const path = t.path || '/'
  const url = `${scheme}//${hostPart}:${t.port}${path.startsWith('/') ? path : '/' + path}`

  steps.push({ id: 'ws', label: 'WS', state: 'running' })
  const ws0 = Date.now()
  let ws: WebSocket
  try {
    ws = await openWebSocket(url, WS_TIMEOUT)
  } catch (e) {
    return fail('ws-blocked', 1, e instanceof Error ? e.message : 'ws-error')
  }
  steps[1] = { id: 'ws', label: 'WS', state: 'ok', latencyMs: Date.now() - ws0 }

  steps.push({ id: 'tunnel', label: 'VLESS', state: 'running' })
  const res = await new Promise<TunnelTestResult>((resolve) => {
    let buf: ArrayBuffer[] = []
    let bufLen = 0
    let headerSkipped = false
    const timer = setTimeout(() => {
      try { ws.close() } catch {}
      resolve(fail('tunnel-blocked', 2, 'timeout'))
    }, TUNNEL_TIMEOUT)

    const finish = (ok: boolean, error?: string) => {
      clearTimeout(timer)
      try { ws.close() } catch {}
      if (ok) {
        steps[2] = { id: 'tunnel', label: 'VLESS', state: 'ok', latencyMs: Date.now() - ws0 }
        resolve({ ok: true, steps, verdict: 'ok' })
      } else {
        resolve(fail('tunnel-blocked', 2, error || 'no-data'))
      }
    }

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return finish(false, 'text-frame')
      buf.push(ev.data)
      bufLen += ev.data.byteLength
      if (!headerSkipped) {
        const head = new Uint8Array(buf[0])
        if (bufLen < 2) return
        const addonLen = head[1]
        if (bufLen < 2 + addonLen) return
        // skip [version, addonLen…]
        buf = [ev.data.slice(2 + addonLen)]
        bufLen = buf[0].byteLength
        headerSkipped = true
      }
      const text = new TextDecoder('latin1').decode(buf[0])
      if (/HTTP\/1\.[01] \d{3}/.test(text)) finish(true)
    }
    ws.onerror = () => finish(false, 'ws-error-mid')
    ws.onclose = (ev) => { if (!headerSkipped || bufLen === 0) finish(false, `closed-${ev.code}`) }
    try {
      ws.send(buildVlessPayload(t).buffer)
    } catch {
      finish(false, 'send-failed')
    }
  })
  return res
}
