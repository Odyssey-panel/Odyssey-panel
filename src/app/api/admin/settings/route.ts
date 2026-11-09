import { requireAuth, jsonSafe } from '@/lib/auth'
import { getSettings, setSettings, redactSettings, type PanelSettings } from '@/lib/settings'
import { hashPassword } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const settings = await getSettings()
  return jsonSafe({ settings: redactSettings(settings) })
}

const EDITABLE_KEYS = new Set(['publicUrl'])

export async function PUT(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const body = (await req.json().catch(() => ({}))) as Record<string, string>

  const patch: Partial<Record<keyof PanelSettings, string>> = {}
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE_KEYS.has(k) && typeof v === 'string') {
      patch[k as keyof PanelSettings] = v
    }
  }
  // password change
  if (body.newPassword) {
    if (String(body.newPassword).length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    patch.adminPassword = hashPassword(String(body.newPassword))
  }

  await setSettings(patch)

  const settings = await getSettings()
  return jsonSafe({ settings: redactSettings(settings) })
}
