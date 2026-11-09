import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'
import { randomBytes } from 'node:crypto'
import { buildServerConfig } from '@/lib/links'

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
  if (body.protocol && body.address && body.port) {
    const isUuid = body.protocol === 'vless' || body.protocol === 'vmess'
    const secret = isUuid ? crypto.randomUUID() : randomBytes(16).toString('base64url')
    const proxyLike = {
      protocol: body.protocol,
      remark: name,
      address: body.address,
      port: Number(body.port),
      secret,
      sni: body.sni || null,
      host: body.host || null,
      path: body.path || '/',
      transport: body.transport || 'ws',
      tls: body.tls ?? true,
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
        serverConfig: JSON.stringify(buildServerConfig(proxyLike)),
      },
    })
  }

  const created = await db.client.findUnique({ where: { id: client.id }, include: { proxies: true } })
  return jsonSafe({ client: created }, { status: 201 })
}

export async function DELETE(req: Request) {
  // bulk delete by ids in body
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] }
  if (!ids?.length) return Response.json({ error: 'ids required' }, { status: 400 })
  await db.client.deleteMany({ where: { id: { in: ids } } })
  return Response.json({ ok: true })
}

