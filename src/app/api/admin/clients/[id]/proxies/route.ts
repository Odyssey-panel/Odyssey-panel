import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'
import { buildServerConfig, isValidFragment } from '@/lib/links'
import { generateSecret, validateProtocol } from '@/lib/secrets'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

type ProxyBody = {
  protocol?: string
  remark?: string
  address?: string
  port?: number
  sni?: string
  host?: string
  path?: string
  transport?: string
  tls?: boolean
  fragment?: string
}

export async function POST(req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const client = await db.client.findUnique({ where: { id } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as ProxyBody
  const protocol = body.protocol || 'vless'
  const protoErr = validateProtocol(protocol)
  if (protoErr) return Response.json({ error: protoErr }, { status: 400 })
  if (body.fragment !== undefined && !isValidFragment(body.fragment)) {
    return Response.json({ error: 'Invalid fragment value' }, { status: 400 })
  }
  const address = (body.address || '').trim()
  const port = Number(body.port)
  if (!address || !port || port < 1 || port > 65535) {
    return Response.json({ error: 'Valid address and port required' }, { status: 400 })
  }

  const secret = generateSecret(protocol)
  const proxyLike = {
    protocol,
    // every Odyssey config is named "Odyssey-<username>" (unless overridden)
    remark: body.remark?.trim() || `Odyssey-${client.name}`,
    address,
    port,
    secret,
    sni: body.sni?.trim() || null,
    host: body.host?.trim() || null,
    path: body.path?.trim() || '/',
    transport: body.transport || 'ws',
    tls: body.tls ?? true,
    fragment: body.fragment?.trim() || null,
  }

  const proxy = await db.proxy.create({
    data: {
      clientId: id,
      protocol: proxyLike.protocol,
      remark: proxyLike.remark,
      address: proxyLike.address,
      port: proxyLike.port,
      secret,
      sni: proxyLike.sni,
      host: proxyLike.host,
      path: proxyLike.path,
      transport: proxyLike.transport,
      tls: proxyLike.tls,
      fragment: proxyLike.fragment,
      serverConfig: JSON.stringify(buildServerConfig(proxyLike)),
    },
  })
  return jsonSafe({ proxy }, { status: 201 })
}
