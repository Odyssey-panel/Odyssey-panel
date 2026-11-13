/**
 * Seed default settings, admin account and an example node.
 * Run: bun prisma/seed.ts   (or: bun run seed)
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'node:crypto'

const db = new PrismaClient()

function hashPassword(password: string, salt?: string) {
  const s = salt ?? randomBytes(16).toString('hex')
  const hash = scryptSync(password, s, 64).toString('hex')
  return `${s}:${hash}`
}

const DEFAULTS: Record<string, string> = {
  // panel
  adminPassword: hashPassword('admin123'),
  panelSecret: randomBytes(32).toString('hex'),
  publicUrl: '', // optional override; otherwise derived from request headers
  lastOrigin: '', // auto-detected origin captured from panel usage
}

async function main() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    })
  }

  const nodeCount = await db.node.count()
  if (nodeCount === 0) {
    await db.node.create({
      data: {
        name: 'Example node (Cloudflare)',
        address: '1.1.1.1',
        port: 443,
        protocol: 'vless',
        tls: true,
        sni: 'cloudflare-dns.com',
        location: 'Singapore',
        note: 'Sample entry used to demo health checks — replace with your real server.',
      },
    })
  }

  console.log('Seed complete: settings + example node ready.')
  console.log('Default admin password: admin123 (change it in Settings)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
