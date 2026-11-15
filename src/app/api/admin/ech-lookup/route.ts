import { isIP } from 'node:net'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GoogleDnsResponse = {
  Answer?: Array<{ type: number; data: string }>
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const body = (await req.json().catch(() => ({}))) as { domain?: string }
  const domain = (body.domain || '').trim().replace(/\.$/, '').toLowerCase()
  const validDomain = domain.length <= 253 &&
    !isIP(domain) &&
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)

  if (!validDomain) {
    return Response.json({ error: 'A valid public domain is required' }, { status: 400 })
  }

  try {
    const url = new URL('https://dns.google/resolve')
    url.searchParams.set('name', domain)
    url.searchParams.set('type', 'HTTPS')
    const response = await fetch(url, {
      headers: { accept: 'application/dns-json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    })
    if (!response.ok) throw new Error('DNS lookup failed')

    const payload = (await response.json()) as GoogleDnsResponse
    const records = (payload.Answer || []).filter((record) => record.type === 65)
    for (const record of records) {
      const match = record.data.match(/(?:^|\s)ech="([A-Za-z0-9+/_=-]+)"/i)
      if (match?.[1]) {
        return Response.json(
          { echConfigList: match[1] },
          { headers: { 'Cache-Control': 'private, max-age=60' } },
        )
      }
    }

    return Response.json(
      { echConfigList: null },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch {
    return Response.json({ error: 'Could not discover an ECH record for this domain' }, { status: 502 })
  }
}
