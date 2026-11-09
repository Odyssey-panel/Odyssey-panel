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
  if (body.url !== undefined) {
    let url = String(body.url).trim()
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    data.url = url
  }
  if (body.note !== undefined) data.note = String(body.note).trim() || null
  const worker = await db.worker.update({ where: { id }, data })
  return jsonSafe({ worker })
}

export async function DELETE(_req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  await db.worker.delete({ where: { id } })
  return Response.json({ ok: true })
}
