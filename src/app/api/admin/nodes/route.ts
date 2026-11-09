import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'

export const runtime = 'nodejs'

type NodeBody = {
  name?: string
  address?: string
  port?: number
  protocol?: string
  tls?: boolean
  sni?: string
  location?: string
  note?: string
}

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const nodes = await db.node.findMany({ orderBy: { createdAt: 'asc' } })
  return jsonSafe({ nodes })
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const body = (await req.json().catch(() => ({}))) as NodeBody
  const name = (body.name || '').trim()
  const address = (body.address || '').trim()
  const port = Number(body.port)
  if (!name || !address || !port || port < 1 || port > 65535) {
    return Response.json({ error: 'Name, address and valid port are required' }, { status: 400 })
  }
  const node = await db.node.create({
    data: {
      name,
      address,
      port,
      protocol: body.protocol || 'vless',
      tls: body.tls ?? true,
      sni: body.sni?.trim() || null,
      location: body.location?.trim() || null,
      note: body.note?.trim() || null,
    },
  })
  return jsonSafe({ node }, { status: 201 })
}
