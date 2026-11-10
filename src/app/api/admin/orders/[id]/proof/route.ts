import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { tgGetFilePath, tgFileUrl } from '@/lib/telegram'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** Streams the payment proof image from Telegram servers (admin only). */
export async function GET(_req: Request, { params }: Params) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const { id } = await params
  const order = await db.order.findUnique({ where: { id } })
  if (!order?.proofFileId) return Response.json({ error: 'No proof attached' }, { status: 404 })

  const settings = await getSettings()
  if (!settings.botToken) return Response.json({ error: 'Bot token not configured' }, { status: 400 })

  const filePath = await tgGetFilePath(settings.botToken, order.proofFileId)
  if (!filePath) return Response.json({ error: 'Could not fetch file info' }, { status: 502 })

  const upstream = await fetch(tgFileUrl(settings.botToken, filePath), {
    signal: AbortSignal.timeout(15000),
  })
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: 'Upstream fetch failed' }, { status: 502 })
  }
  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') || 'image/jpeg',
      'cache-control': 'private, max-age=60',
    },
  })
}
