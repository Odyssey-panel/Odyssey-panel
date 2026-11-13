/**
 * One-time normalization: every proxy remark must start with "Odyssey-"
 * (mandatory branding). Idempotent — rows that already carry the prefix
 * are left untouched, so it is safe to run on every boot.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

try {
  const renamed = await db.$executeRawUnsafe(
    `UPDATE Proxy SET remark = 'Odyssey-' || remark WHERE remark NOT LIKE 'Odyssey-%'`
  )
  console.log(`[remark-migrate] renamed ${renamed} config(s) to the Odyssey- prefix`)
} catch (e) {
  console.error('[remark-migrate] failed (continuing anyway):', e?.message || e)
} finally {
  await db.$disconnect()
}
