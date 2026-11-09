import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'
import { buildServerConfig } from '@/lib/links'
import { randomBytes } from 'node:crypto'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const proxy = await db.proxy.findUnique({ where: { id } })
  if (!proxy) return Response.json({ error: 'Not found' }, { status: 404 })
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const data: Record<string, unknown> = {}
  for (const key of ['remark', 'address', 'sni', 'host', 'path', 'transport'] as const) {
    if (body[key] !== undefined) data[key] = String(body[key])
  }
  if (body.port !== undefined) data.port = Number(body.port)
  if (body.tls !== undefined) data.tls = Boolean(body.tls)
  if (body.rotateSecret === true) {
    const isUuid = proxy.protocol === 'vless' || proxy.protocol === 'vmess'
    data.secret = isUuid ? crypto.randomUUID() : randomBytes(16).toString('base64url')
  }

  const updated = await db.proxy.update({ where: { id }, data })
  // rebuild server config snapshot
  await db.proxy.update({
    where: { id },
    data: {
      serverConfig: JSON.stringify(
        buildServerConfig({
          protocol: updated.protocol,
          remark: updated.remark,
          address: updated.address,
          port: updated.port,
          secret: updated.secret,
          sni: updated.sni,
          host: updated.host,
          path: updated.path,
          transport: updated.transport,
          tls: updated.tls,
          flow: null,
        })
      ),
    },
  })
  const fresh = await db.proxy.findUnique({ where: { id } })
  return jsonSafe({ proxy: fresh })
}

export async function DELETE(_req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  await db.proxy.delete({ where: { id } })
  return Response.json({ ok: true })
}
