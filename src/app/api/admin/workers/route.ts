import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const workers = await db.worker.findMany({ orderBy: { createdAt: 'asc' } })
  return jsonSafe({ workers })
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const body = (await req.json().catch(() => ({}))) as { name?: string; url?: string; note?: string }
  const name = (body.name || '').trim()
  let url = (body.url || '').trim()
  if (!name || !url) return Response.json({ error: 'Name and URL required' }, { status: 400 })
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    new URL(url)
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }
  const worker = await db.worker.create({ data: { name, url, note: body.note?.trim() || null } })
  return jsonSafe({ worker }, { status: 201 })
}
