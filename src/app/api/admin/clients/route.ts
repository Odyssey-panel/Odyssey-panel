import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'
import { randomBytes } from 'node:crypto'
import { buildServerConfig } from '@/lib/links'
import { generateSecret, validateProtocol } from '@/lib/secrets'
import { isValidFragment } from '@/lib/links'
import { normalizeProxyTarget, panelHost, syncBackend } from '@/lib/backend'

export const runtime = 'nodejs'

type CreateBody = {
  name?: string
  note?: string
  trafficGb?: number // 0 = unlimited
  days?: number // days from now; 0/null = never
  expiresAt?: string | null
  // optional first proxy account
  protocol?: string
  address?: string
  port?: number
  sni?: string
  transport?: string
  host?: string
  path?: string
  tls?: boolean
  fragment?: string
}

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const clients = await db.client.findMany({
    include: { proxies: true },
    orderBy: { createdAt: 'desc' },
  })
  return jsonSafe({ clients })
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const body = (await req.json().catch(() => ({}))) as CreateBody

  const name = (body.name || '').trim()
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })
  const exists = await db.client.findUnique({ where: { name } })
  if (exists) return Response.json({ error: 'Name already exists' }, { status: 409 })

  const subToken = randomBytes(16).toString('hex')
  const expiresAt =
    body.expiresAt
      ? new Date(body.expiresAt)
      : body.days && body.days > 0
        ? new Date(Date.now() + body.days * 86400000)
        : null
  if (expiresAt && isNaN(expiresAt.getTime())) {
    return Response.json({ error: 'Invalid expiry date' }, { status: 400 })
  }

  const client = await db.client.create({
    data: {
      name,
      note: body.note || null,
      limitBytes: BigInt(Math.round((body.trafficGb ?? 0) * 1024 ** 3)),
      expiresAt,
      subToken,
    },
  })

  // Optionally generate the first proxy account right away
  if (body.protocol && body.address && body.address.trim()) {
    const protoErr = validateProtocol(body.protocol)
    if (protoErr) return Response.json({ error: protoErr }, { status: 400 })
    if (body.fragment && !isValidFragment(body.fragment)) {
      return Response.json({ error: 'Invalid fragment value' }, { status: 400 })
    }
    const secret = generateSecret(body.protocol)
    const norm = normalizeProxyTarget(
      {
        address: body.address,
        port: body.port,
        sni: body.sni,
        host: body.host,
        path: body.path,
        transport: body.transport,
        tls: body.tls,
      },
      await panelHost(),
    )
    const proxyLike = {
      protocol: body.protocol,
      // every Odyssey config is named "Odyssey-<username>"
      remark: `Odyssey-${name}`,
      address: norm.address,
      port: norm.port ?? 443,
      secret,
      sni: norm.sni ?? null,
      host: norm.host ?? null,
      path: norm.path ?? '/',
      transport: norm.transport ?? 'ws',
      tls: norm.tls ?? true,
      fragment: body.fragment?.trim() || null,
    }
    await db.proxy.create({
      data: {
        clientId: client.id,
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
  }

  const created = await db.client.findUnique({ where: { id: client.id }, include: { proxies: true } })
  syncBackend()
  return jsonSafe({ client: created }, { status: 201 })
}

export async function DELETE(req: Request) {
  // bulk delete by ids in body
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] }
  if (!ids?.length) return Response.json({ error: 'ids required' }, { status: 400 })
  await db.client.deleteMany({ where: { id: { in: ids } } })
  syncBackend()
  return Response.json({ ok: true })
}

