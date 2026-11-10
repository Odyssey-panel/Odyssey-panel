import { requireAuth, jsonSafe } from '@/lib/auth'
import { approveOrder, rejectOrder } from '@/lib/telegram'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const { action } = (await req.json().catch(() => ({}))) as { action?: 'approve' | 'reject' }
  if (action !== 'approve' && action !== 'reject') {
    return Response.json({ error: 'action must be approve or reject' }, { status: 400 })
  }
  const settings = await getSettings()
  const res = action === 'approve' ? await approveOrder(id, settings) : await rejectOrder(id, settings)
  if (!res.ok) return Response.json({ error: res.description || 'Failed' }, { status: 400 })
  const order = await db_safe(id)
  return jsonSafe({ order })
}

async function db_safe(id: string) {
  const { db } = await import('@/lib/db')
  return db.order.findUnique({ where: { id }, include: { client: true } })
}
