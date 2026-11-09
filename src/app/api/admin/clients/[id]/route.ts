import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

type PatchBody = {
  name?: string
  note?: string
  trafficGb?: number
  daysExtend?: number
  expiresAt?: string | null
  status?: 'active' | 'disabled'
}

export async function GET(_req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const client = await db.client.findUnique({ where: { id }, include: { proxies: true } })
  if (!client) return Response.json({ error: 'Not found' }, { status: 404 })
  return jsonSafe({ client })
}

export async function PATCH(req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as PatchBody
  const client = await db.client.findUnique({ where: { id } })
  if (!client) return Response.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return Response.json({ error: 'Name required' }, { status: 400 })
    const dupe = await db.client.findFirst({ where: { name, id: { not: id } } })
    if (dupe) return Response.json({ error: 'Name already exists' }, { status: 409 })
    data.name = name
  }
  if (body.note !== undefined) data.note = body.note || null
  if (body.trafficGb !== undefined) data.limitBytes = BigInt(Math.round(body.trafficGb * 1024 ** 3))
  if (body.status !== undefined) data.status = body.status
  if (body.expiresAt !== undefined) {
    data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  }
  if (body.daysExtend && body.daysExtend > 0) {
    const current = client.expiresAt && client.expiresAt.getTime() > Date.now() ? client.expiresAt.getTime() : Date.now()
    data.expiresAt = new Date(current + body.daysExtend * 86400000)
  }

  const updated = await db.client.update({ where: { id }, data, include: { proxies: true } })
  return jsonSafe({ client: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  await db.client.delete({ where: { id } })
  return Response.json({ ok: true })
}
