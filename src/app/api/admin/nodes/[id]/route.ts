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
  for (const key of ['name', 'address', 'protocol', 'sni', 'location', 'note'] as const) {
    if (body[key] !== undefined) data[key] = String(body[key]).trim() || null
  }
  if (body.port !== undefined) data.port = Number(body.port)
  if (body.tls !== undefined) data.tls = Boolean(body.tls)
  const node = await db.node.update({ where: { id }, data })
  return jsonSafe({ node })
}

export async function DELETE(_req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  await db.node.delete({ where: { id } })
  return Response.json({ ok: true })
}
