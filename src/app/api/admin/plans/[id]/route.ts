import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = String(body.name).trim()
  if (body.price !== undefined) data.price = Number(body.price) || 0
  if (body.currency !== undefined) data.currency = String(body.currency).toUpperCase().slice(0, 6)
  if (body.trafficGb !== undefined) data.trafficGb = Number(body.trafficGb) || 10
  if (body.durationDays !== undefined) data.durationDays = Number(body.durationDays) || 30
  if (body.description !== undefined) data.description = String(body.description).trim() || null
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.sort !== undefined) data.sort = Number(body.sort) || 0
  const plan = await db.plan.update({ where: { id }, data })
  return jsonSafe({ plan })
}

export async function DELETE(_req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  // detach orders instead of failing on FK constraint
  await db.order.updateMany({ where: { planId: id }, data: { planId: null } })
  await db.plan.delete({ where: { id } })
  return Response.json({ ok: true })
}
