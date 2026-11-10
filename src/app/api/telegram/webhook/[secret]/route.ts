import { getSettings } from '@/lib/settings'
import { handleUpdate, type TgUpdate } from '@/lib/telegram'

export const runtime = 'nodejs'

type Params = { params: Promise<{ secret: string }> }

/** Telegram webhook receiver — enable by setting botMode=webhook and calling setWebhook with /api/telegram/webhook/<secret>. */
export async function POST(req: Request, { params }: Params) {
  const { secret } = await params
  const settings = await getSettings()
  if (!settings.webhookSecret || secret !== settings.webhookSecret) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const update = (await req.json().catch(() => null)) as TgUpdate | null
  if (!update) return Response.json({ ok: false }, { status: 400 })
  try {
    await handleUpdate(update, settings)
  } catch (e) {
    console.error('[telegram webhook] handler error', e)
  }
  return Response.json({ ok: true })
}
