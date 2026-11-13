import { renewSessionIfDue, verifySession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const ok = await verifySession()
  if (ok) await renewSessionIfDue()
  return Response.json({ ok })
}
