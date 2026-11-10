import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const status = new URL(req.url).searchParams.get('status')
  const orders = await db.order.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return jsonSafe({ orders })
}
