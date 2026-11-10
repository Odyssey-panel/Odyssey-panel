/**
 * Built-in backend + address normalization helpers.
 *
 * The panel ships a real vless+ws backend (xray-core) inside its own
 * container, exposed on the panel's own HTTPS domain under /vlessws.
 * That makes every generated config genuinely work with zero external
 * setup — the admin pastes nothing, the panel IS the server.
 *
 * normalizeAddressInput() additionally repairs pasted URLs like
 * "https://foo.workers.dev/path" or the panel's own URL so the panel
 * never emits a broken vless:// link again.
 */
import type { PanelSettings } from './settings'

/** The ws path served by the built-in xray backend. */
export const BUILTIN_WS_PATH = '/vlessws'

export type AddressParse = {
  /** clean host: IPv4 / bracketed-free IPv6 / domain */
  address: string
  /** explicit port found in the input, if any */
  port?: number
  /** scheme implied TLS */
  tls?: boolean
  /** path portion of a pasted URL */
  path?: string
  /** host portion of a pasted URL (for the Host header) */
  host?: string
}

/**
 * Parse any user-supplied "server address" into its parts. Accepts:
 *  - bare host            → vps.example.com
 *  - bare IPv6            → 2001:db8::1
 *  - host:port            → vps.example.com:8443
 *  - full URL             → https://foo.workers.dev/ws?ed=2560
 */
export function parseAddressInput(raw: string): AddressParse {
  const input = (raw || '').trim()
  if (!input) return { address: '' }

  // Full URL form
  if (/^https?:\/\//i.test(input) || /^[\w.+-]+\.[a-z]{2,}(\/|$|\?)/i.test(input)) {
    try {
      const u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
      const hostname = u.hostname
      const hasIpv6 = hostname.includes(':')
      const explicitPort = u.port ? Number(u.port) : undefined
      const path = `${u.pathname}${u.search || ''}` || undefined
      return {
        address: hostname,
        port: explicitPort,
        tls: u.protocol === 'https:' ? true : u.protocol === 'http:' ? false : undefined,
        path: path && path !== '/' ? path : undefined,
        host: hostname || undefined,
      }
    } catch {
      /* fall through to bare parsing */
    }
  }

  // host:port (careful with bare IPv6 — only split on the LAST colon when
  // there is exactly one colon and what follows is a short port number)
  const m = input.match(/^(\[[^\]]+\]|[^:]+):(\d{1,5})$/)
  if (m) {
    return { address: m[1].replace(/^\[|\]$/g, ''), port: Number(m[2]) }
  }
  return { address: input }
}

/** Best known public host of this panel deployment. */
export async function panelHost(): Promise<string> {
  const { getSettings } = await import('./settings')
  const s: PanelSettings = await getSettings()
  const url = s.publicUrl || s.lastOrigin
  if (!url) return ''
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export type BuiltinFields = {
  address: string
  port: number
  transport: 'ws'
  tls: true
  sni: string
  host: string
  path: string
}

/** The proxy fields that point a config at the built-in backend. */
export function builtinBackendFields(host: string): BuiltinFields {
  return {
    address: host,
    port: 443,
    transport: 'ws',
    tls: true,
    sni: host,
    host,
    path: BUILTIN_WS_PATH,
  }
}

/**
 * Server-side normalization applied to every proxy payload before it is
 * stored. Repairs URL-like addresses and switches to the built-in backend
 * when the pasted address is the panel's own domain (the most common
 * "configs don't work" mistake — the panel now actually backs it).
 */
export function normalizeProxyTarget(
  input: {
    address?: string | null
    port?: number | null
    sni?: string | null
    host?: string | null
    path?: string | null
    transport?: string | null
    tls?: boolean | null
  },
  panelHostname: string,
  builtin = true,
): {
  address: string
  port?: number
  sni?: string
  host?: string
  path?: string
  transport?: string
  tls?: boolean
  usedBuiltin: boolean
  note?: string
} {
  const parsed = parseAddressInput(input.address || '')
  let address = parsed.address
  let port = input.port ?? undefined
  let tls = input.tls ?? undefined
  let sni = input.sni?.trim() || undefined
  let host = input.host?.trim() || undefined
  let path = input.path?.trim() || undefined
  let transport = input.transport?.trim() || undefined
  let usedBuiltin = false
  let note: string | undefined

  if (parsed.port && (port === undefined || port === 443)) port = parsed.port
  if (parsed.tls !== undefined && tls === undefined) tls = parsed.tls
  if (parsed.path && (!path || path === '/')) path = parsed.path
  if (parsed.host && !host) host = parsed.host

  // Pasted the panel's own URL/domain → serve through the built-in backend
  const isPanelHost =
    !!panelHostname && !!address && hostOf(address) === panelHostname
  if (builtin && isPanelHost) {
    const f = builtinBackendFields(panelHostname)
    return { ...f, usedBuiltin: true, note: 'builtin-backend' }
  }

  // Pasted a Cloudflare worker URL → tls+ws through the worker domain
  if (/\.workers\.dev$/i.test(address) && !tls && tls !== false) tls = true

  if (!sni && tls && address && !address.includes(':')) sni = address
  if (!host && tls) host = host || sni
  return { address, port, sni, host, path, transport, tls, usedBuiltin, note }
}

/** Wrap bare IPv6 in [] (duplicate of links.hostOf without the import cycle). */
export function hostOf(address: string): string {
  const a = (address || '').trim()
  if (a.includes(':') && !a.startsWith('[')) return `[${a}]`
  return a
}

/** Fire-and-forget xray resync after admin mutations (production only). */
export function syncBackend(): void {
  try {
    const { spawn } = require('node:child_process') as typeof import('node:child_process')
    const { existsSync } = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const bin = path.join(process.cwd(), 'bin', 'xray')
    if (!existsSync(bin)) return // dev environment without the backend
    const child = spawn(process.execPath, ['scripts/xray-sync.mjs'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
      env: process.env,
    })
    child.unref()
  } catch {
    // never block admin flows on backend sync
  }
}
