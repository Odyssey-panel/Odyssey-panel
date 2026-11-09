import { verifySession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json({ ok: await verifySession() })
}
