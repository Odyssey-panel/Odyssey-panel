import { verifyPassword, createSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string }
  if (!password) return Response.json({ error: 'Password required' }, { status: 400 })
  const settings = await getSettings()
  if (!settings.adminPassword) {
    return Response.json({ error: 'Panel not initialized' }, { status: 500 })
  }
  if (!verifyPassword(password, settings.adminPassword)) {
    return Response.json({ error: 'Wrong password' }, { status: 401 })
  }
  await createSession()
  return Response.json({ ok: true })
}
