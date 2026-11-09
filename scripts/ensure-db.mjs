/**
 * Schema self-healing (runs inside the container before the server starts).
 *
 * Verifies that the live database actually contains all panel tables.
 * If not — e.g. `prisma db push` could not run inside the container —
 * restores a complete, empty schema from prisma/template.db which is baked
 * into the image at build time. Uses only @prisma/client (no prisma CLI),
 * so it works even when the CLI is broken or unavailable.
 */
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL || 'file:/data/panel.db'
const dbFile = dbUrl.startsWith('file:') ? dbUrl.slice('file:'.length) : null
const template = path.resolve(process.cwd(), 'prisma/template.db')

const REQUIRED_TABLES = ['Setting', 'Client', 'Node', 'Worker', 'Proxy']

async function schemaOk() {
  // fresh client per probe so the engine re-reads the file from disk
  const probe = new PrismaClient()
  try {
    const rows = await probe.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${REQUIRED_TABLES.map(() => '?').join(',')})`,
      ...REQUIRED_TABLES
    )
    return rows.length === REQUIRED_TABLES.length
  } finally {
    await probe.$disconnect().catch(() => {})
  }
}

try {
  if (await schemaOk()) {
    console.log('[boot] database schema verified — all panel tables present')
    process.exit(0)
  }

  console.log('[boot] schema incomplete — restoring from baked-in template…')
  if (!existsSync(template)) {
    console.error('[boot] ERROR: prisma/template.db not found in image — cannot restore schema')
    process.exit(1)
  }
  if (dbFile) {
    mkdirSync(path.dirname(dbFile), { recursive: true })
    copyFileSync(template, dbFile)
  }

  if (await schemaOk()) {
    console.log('[boot] database schema restored from template — panel tables are ready')
  } else {
    console.error('[boot] ERROR: schema still incomplete after restore')
    process.exit(1)
  }
} catch (e) {
  // never block boot here — the server and the login route have their own fallbacks
  console.error('[boot] ensure-db failed (continuing anyway):', e?.message || e)
  process.exit(0)
}
