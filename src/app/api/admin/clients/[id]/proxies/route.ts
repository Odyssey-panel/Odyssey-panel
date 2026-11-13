import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'
import { buildServerConfig, isValidFragment } from '@/lib/links'
import { generateSecret, validateProtocol } from '@/lib/secrets'
import { normalizeProxyTarget, panelHost, syncBackend } from '@/lib/backend'

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
  if (!address) {
    return Response.json({ error: 'Valid address required' }, { status: 400 })
  }
  const norm = normalizeProxyTarget(
    {
      address,
      port,
      sni: body.sni,
      host: body.host,
      path: body.path,
      transport: body.transport,
      tls: body.tls,
    },
    await panelHost(),
  )
  const finalPort = norm.port ?? port
  if (!finalPort || finalPort < 1 || finalPort > 65535) {
    return Response.json({ error: 'Valid port required' }, { status: 400 })
  }

  const secret = generateSecret(protocol)
  // MANDATORY branding: every Odyssey config starts with "Odyssey-".
  // A typed remark gets the prefix automatically; empty falls back to the
  // client's name. (The UI also defaults the field to "Odyssey-<name>".)
  const rawRemark = body.remark?.trim() || ''
  const proxyLike = {
    protocol,
    remark: rawRemark
      ? rawRemark.startsWith('Odyssey-')
        ? rawRemark
        : `Odyssey-${rawRemark}`
      : `Odyssey-${client.name}`,
    address: norm.address,
    port: finalPort,
    secret,
    sni: norm.sni ?? null,
    host: norm.host ?? null,
    path: norm.path ?? '/',
    transport: norm.transport ?? 'ws',
    tls: norm.tls ?? true,
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
  syncBackend()
  return jsonSafe({ proxy }, { status: 201 })
}