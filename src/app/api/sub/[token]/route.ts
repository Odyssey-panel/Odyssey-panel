import { db } from '@/lib/db'
import { buildSubscription, type SubFormat, type ProxyLike } from '@/lib/links'

export const runtime = 'nodejs'

type Params = { params: Promise<{ token: string }> }

/**
 * Public subscription endpoint.
 * The URL works on whatever domain the panel is deployed on because the
 * client apps only need the path; QR codes and copy buttons in the panel
 * are built from the current request origin at runtime.
 *
 * Formats: base64 (default, v2rayNG etc.), raw, clash, singbox
 */
export async function GET(req: Request, { params }: Params) {
  const { token } = await params
  if (!/^[a-f0-9]{16,64}$/i.test(token)) {
    return new Response('Invalid token', { status: 404 })
  }
  const client = await db.client.findUnique({ where: { subToken: token }, include: { proxies: true } })
  if (!client) return new Response('Subscription not found', { status: 404 })

  if (client.status !== 'active') {
    return new Response('Subscription disabled', { status: 403 })
  }
  if (client.expiresAt && client.expiresAt.getTime() < Date.now()) {
    return new Response('Subscription expired', { status: 403 })
  }
  if (client.limitBytes > 0 && client.usedBytes >= client.limitBytes) {
    return new Response('Traffic limit reached', { status: 403 })
  }

  const url = new URL(req.url)
  const format = (url.searchParams.get('format') || 'base64') as SubFormat
  const proxies: ProxyLike[] = client.proxies.map((p) => ({
    protocol: p.protocol,
    remark: p.remark,
    address: p.address,
    port: p.port,
    secret: p.secret,
    sni: p.sni,
    host: p.host,
    path: p.path,
    transport: p.transport,
    tls: p.tls,
    flow: p.flow,
  }))

  const { body, contentType } = buildSubscription(proxies, format)
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
      'profile-update-interval': '6',
      'content-disposition': `attachment; filename="Odyssey-${client.name}"`,
    },
  })
}
