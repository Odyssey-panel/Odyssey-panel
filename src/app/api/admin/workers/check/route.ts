import { requireAuth, jsonSafe } from '@/lib/auth'
import { checkWorkerById, checkAllWorkers } from '@/lib/health'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id, all } = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean }

  if (all) {
    const count = await checkAllWorkers()
    return jsonSafe({ checked: count })
  }
  if (!id) return Response.json({ error: 'id or all required' }, { status: 400 })
  const worker = await checkWorkerById(id)
  if (!worker) return Response.json({ error: 'Not found' }, { status: 404 })
  return jsonSafe({ worker })
}
