'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Instant-switch cache (SWR-style): GET responses are kept in memory so a
// view that remounts renders its data on the FIRST paint (no spinner, no
// waiting for the network) and then quietly revalidates in the background.
// This is what makes switching views feel like "speed of light".
// ────────────────────────────────────────────────────────────────────────────

type CacheEntry = { data: unknown; at: number }
const cache = new Map<string, CacheEntry>()

/** Background revalidate if the cached copy is older than this. */
const STALE_MS = 15_000

/** Fire-and-forget GETs that fill the cache before a view even mounts. */
export function prewarm(urls: string[]) {
  for (const u of urls) void api(u).catch(() => {})
}

export async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts?.headers || {}) },
  })
  if (res.status === 401) {
    // Surface the server's actual reason ("Wrong password", …) instead of a
    // generic Unauthorized — a wrong password on the login form is NOT a
    // session expiry, so only broadcast session loss for admin API calls.
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!url.startsWith('/api/auth/login')) {
      window.dispatchEvent(new Event('panel:unauthorized'))
    }
    throw new ApiError(body.error || 'Unauthorized', 401)
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status)
  if (!opts?.method || opts.method === 'GET') cache.set(url, { data, at: Date.now() })
  return data as T
}

export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef(url)
  urlRef.current = url
  const lastFetchAt = useRef(0)

  const reload = useCallback(async () => {
    const u = urlRef.current
    if (!u) return
    try {
      setError(null)
      const d = await api<T>(u)
      lastFetchAt.current = Date.now()
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Hydrate instantly from cache — the view paints real data on frame one.
    const hit = url ? cache.get(url) : undefined
    if (hit) {
      setData(hit.data as T)
      setLoading(false)
    } else {
      setLoading(Boolean(url))
    }
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])

  // Kept-alive views never remount, so the panel announces every view switch;
  // each hook revalidates quietly if its data went stale.
  useEffect(() => {
    const onRevalidate = () => {
      if (!urlRef.current) return
      if (Date.now() - lastFetchAt.current < STALE_MS) return
      void reload()
    }
    window.addEventListener('panel:revalidate', onRevalidate)
    return () => window.removeEventListener('panel:revalidate', onRevalidate)
  }, [reload])

  return { data, loading, error, reload, setData }
}
