import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'
import { isValidFragment } from '@/lib/links'

export const runtime = 'nodejs'

/**
 * Bulk-apply an anti-censorship fragment value to every proxy account
 * (optionally filtered by protocol). Body: { fragment?: string, protocol?: string }
 * Empty fragment clears the value.
 */
export async function POST(req: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  const body = (await req.json().catch(() => ({}))) as { fragment?: string; protocol?: string }

  const fragment = (body.fragment || '').trim()
  if (!isValidFragment(fragment)) {
    return Response.json({ error: 'Invalid fragment value' }, { status: 400 })
  }

  const where: Record<string, unknown> = {}
  if (body.protocol) where.protocol = body.protocol

  const result = await db.proxy.updateMany({ where, data: { fragment: fragment || null } })
  return jsonSafe({ updated: result.count })
}
