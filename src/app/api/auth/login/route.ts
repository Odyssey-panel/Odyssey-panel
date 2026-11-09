import { verifyPassword, createSession, hashPassword } from '@/lib/auth'
import { getSettings, setSettings } from '@/lib/settings'
import { randomBytes } from 'node:crypto'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string }
  if (!password) return Response.json({ error: 'Password required' }, { status: 400 })
  const settings = await getSettings()
  let adminPassword = settings.adminPassword
  if (!adminPassword) {
    // Self-heal: if the boot seeder could not run (fresh/permission-blocked volume),
    // initialize the same defaults as prisma/seed.boot.mjs on first login attempt.
    try {
      adminPassword = hashPassword('admin123')
      await setSettings({
        adminPassword,
        panelSecret: randomBytes(32).toString('hex'),
      })
    } catch {
      return Response.json({ error: 'Database not writable — check the volume mount at /data' }, { status: 500 })
    }
  }
  if (!verifyPassword(password, adminPassword)) {
    return Response.json({ error: 'Wrong password' }, { status: 401 })
  }
  await createSession()
  return Response.json({ ok: true })
}
