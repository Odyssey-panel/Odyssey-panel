import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }
const GB = 1024 ** 3

export async function POST(req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { reset?: boolean; usedGb?: number }
  const client = await db.client.findUnique({ where: { id } })
  if (!client) return Response.json({ error: 'Not found' }, { status: 404 })

  const data = body.reset
    ? { usedBytes: BigInt(0) }
    : { usedBytes: BigInt(Math.max(0, Math.round((body.usedGb ?? 0) * GB))) }

  const updated = await db.client.update({ where: { id }, data })
  return jsonSafe({ client: updated })
}
