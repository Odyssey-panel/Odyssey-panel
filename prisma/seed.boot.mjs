/**
 * Boot-time seeder (plain Node, no bun/ts runtime needed).
 * Runs inside the container before the server starts — idempotent:
 * only creates defaults that don't exist yet, never overwrites user data.
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'node:crypto'

const db = new PrismaClient()

function hashPassword(password) {
  const s = randomBytes(16).toString('hex')
  const hash = scryptSync(password, s, 64).toString('hex')
  return `${s}:${hash}`
}

const DEFAULTS = () => ({
  adminPassword: hashPassword('admin123'),
  panelSecret: randomBytes(32).toString('hex'),
  publicUrl: '',
  lastOrigin: '',
})

const EXAMPLE_NODE = {
  name: 'Example node (Cloudflare)',
  address: '1.1.1.1',
  port: 443,
  protocol: 'vless',
  tls: true,
  sni: 'cloudflare-dns.com',
  location: 'Anycast',
  note: 'Sample entry used to demo health checks — replace with your real server.',
}

async function main() {
  const defaults = DEFAULTS()
  const existing = await db.setting.findMany()
  const have = new Set(existing.map((s) => s.key))
  for (const [key, value] of Object.entries(defaults)) {
    if (!have.has(key)) await db.setting.create({ data: { key, value } })
  }

  const nodeCount = await db.node.count()
  if (nodeCount === 0) {
    await db.node.create({ data: EXAMPLE_NODE })
  }

  console.log('[boot-seed] settings:', existing.length, '· nodes:', nodeCount)
}

main()
  .catch((e) => {
    console.error('[boot-seed] failed (continuing anyway):', e?.message || e)
  })
  .finally(() => db.$disconnect())
