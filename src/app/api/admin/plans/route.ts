import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const plans = await db.plan.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] })
  return jsonSafe({ plans })
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const name = String(body.name || '').trim()
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })
  const plan = await db.plan.create({
    data: {
      name,
      price: Number(body.price) || 0,
      currency: String(body.currency || 'USD').toUpperCase().slice(0, 6),
      trafficGb: Number(body.trafficGb) || 10,
      durationDays: Number(body.durationDays) || 30,
      description: body.description ? String(body.description).trim() : null,
      active: body.active === undefined ? true : Boolean(body.active),
      sort: Number(body.sort) || 0,
    },
  })
  return jsonSafe({ plan }, { status: 201 })
}
