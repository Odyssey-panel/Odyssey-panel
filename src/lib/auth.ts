import { cookies, headers } from 'next/headers'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getSettings, setSettings } from '@/lib/settings'

const COOKIE_NAME = 'panel_session'
// 30 days — the admin should not be logged out every day just because the
// session expired (the old 12h TTL made the panel look broken with 401s).
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
// While the panel is actively used, slide the session forward once less than
// this much time remains, so a busy admin is never interrupted.
const RENEW_THRESHOLD_MS = 20 * 24 * 60 * 60 * 1000

export function hashPassword(password: string, salt?: string) {
  const s = salt ?? randomBytes(16).toString('hex')
  const hash = scryptSync(password, s, 64).toString('hex')
  return `${s}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Create a signed session cookie for the admin. */
export async function createSession() {
  const { panelSecret } = await getSettings()
  const exp = Date.now() + SESSION_TTL_MS
  const payload = `admin.${exp}`
  const sig = sign(payload, panelSecret)
  const store = await cookies()
  store.set(COOKIE_NAME, `${payload}.${sig}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

/**
 * Slide the session forward: when the current cookie has less than
 * RENEW_THRESHOLD_MS left, re-issue it with a fresh full TTL. Called from
 * /api/auth/me which the panel hits on every load.
 */
export async function renewSessionIfDue() {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return
  const parts = raw.split('.')
  if (parts.length !== 3) return
  const exp = Number(parts[1])
  if (!Number.isFinite(exp)) return
  if (exp - Date.now() >= RENEW_THRESHOLD_MS) return
  await createSession()
}

export async function destroySession() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** Verify the signed session cookie. */
export async function verifySession(): Promise<boolean> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return false
  const parts = raw.split('.')
  if (parts.length !== 3) return false
  const [user, exp, sig] = parts
  const expNum = Number(exp)
  if (user !== 'admin' || !Number.isFinite(expNum) || expNum < Date.now()) return false
  const { panelSecret } = await getSettings()
  const expected = sign(`${user}.${exp}`, panelSecret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Guard for admin API routes.
 * Returns a 401 Response when unauthorized, otherwise null.
 * Also captures the current request origin so subscription links always
 * point at the domain the panel is actually served from.
 */
export async function requireAuth(): Promise<Response | null> {
  const ok = await verifySession()
  if (!ok) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await captureOrigin()
  return null
}

/** Remember the most recent origin the panel was used on (fallback for subscription links). */
export async function captureOrigin() {
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    if (!host) return
    const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const origin = `${proto}://${host}`
    const { publicUrl, lastOrigin } = await getSettings()
    if (!publicUrl && lastOrigin !== origin) {
      await setSettings({ lastOrigin: origin })
    }
  } catch {
    // headers not available in this context — ignore
  }
}

/** JSON helper that converts BigInt values to Number for API responses. */
export function jsonSafe(data: unknown, init?: ResponseInit) {
  const body = JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  )
  return new Response(body, {
    ...init,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(init?.headers || {}) },
  })
}
