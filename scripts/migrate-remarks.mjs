/**
 * One-time normalizations (idempotent — safe to run on every boot):
 * 1. every proxy remark must start with "Odyssey-" (mandatory branding);
 *    rows that already carry the prefix are left untouched.
 * 2. every node location is normalized to Singapore — the operator's home
 *    region label (empty / "Anycast" placeholders get replaced, explicit
 *    custom locations are left untouched).
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

try {
  const renamed = await db.$executeRawUnsafe(
    `UPDATE Proxy SET remark = 'Odyssey-' || remark WHERE remark NOT LIKE 'Odyssey-%'`
  )
  console.log(`[remark-migrate] renamed ${renamed} config(s) to the Odyssey- prefix`)

  const moved = await db.$executeRawUnsafe(
    `UPDATE Node SET location = 'Singapore'
      WHERE location IS NULL OR TRIM(location) = '' OR TRIM(location) = 'Anycast'`
  )
  console.log(`[remark-migrate] set location=Singapore on ${moved} node(s)`)
} catch (e) {
  console.error('[remark-migrate] failed (continuing anyway):', e?.message || e)
} finally {
  await db.$disconnect()
}
