#!/usr/bin/env node
/**
 * migrate-addresses — one-time repair for proxy rows whose "address" is not
 * a host at all. Before normalization existed, admins pasted full URLs like
 * "https://odyssey-panel-production.up.railway.app/" into the address field,
 * which produced syntactically broken vless:// links (the "configs don't
 * work" bug). This script rewrites such rows:
 *
 *   - URL pointing at the panel's own domain → converted to the built-in
 *     backend fields (address=panel host, port 443, ws, tls, path /vlessws)
 *   - any other URL → clean host extracted (+port/tls from the URL)
 *
 * Idempotent: clean addresses are left untouched. Runs once per boot.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const PANEL_DOMAIN = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim()

function hostOf(a) {
  const x = (a || '').trim()
  if (x.includes(':') && !x.startsWith('[')) return `[${x}]`
  return x
}

function parse(raw) {
  const input = (raw || '').trim()
  if (!/^https?:\/\//i.test(input)) return null
  try {
    return new URL(input)
  } catch {
    return null
  }
}

async function main() {
  const rows = await db.proxy.findMany()
  let fixed = 0
  for (const p of rows) {
    const u = parse(p.address)
    if (!u) continue
    const hostname = u.hostname
    if (!hostname) continue
    const isPanel = PANEL_DOMAIN && hostname === PANEL_DOMAIN
    const data = isPanel
      ? {
          address: hostname,
          port: 443,
          transport: 'ws',
          tls: true,
          sni: hostname,
          host: hostname,
          path: '/vlessws',
        }
      : {
          address: hostname,
          port: u.port ? Number(u.port) : p.port,
          tls: u.protocol === 'https:' ? true : p.tls,
          sni: p.sni || hostname,
          host: p.host || hostname,
          path: u.pathname && u.pathname !== '/' ? u.pathname : p.path,
        }
    await db.proxy.update({ where: { id: p.id }, data })
    console.log(`[migrate] fixed proxy ${p.id} (${p.remark}): '${p.address}' → '${data.address}:${data.port}'${isPanel ? ' [built-in backend]' : ''}`)
    fixed++
  }
  // same repair for the address book (nodes)
  const nodes = await db.node.findMany()
  for (const n of nodes) {
    const u = parse(n.address)
    if (!u) continue
    if (!u.hostname) continue
    await db.node.update({
      where: { id: n.id },
      data: {
        address: u.hostname,
        port: u.port ? Number(u.port) : n.port,
        tls: u.protocol === 'https:' ? true : n.tls,
        sni: n.sni || u.hostname,
      },
    })
    console.log(`[migrate] fixed node ${n.id} (${n.name}): '${n.address}' → '${u.hostname}'`)
    fixed++
  }
  console.log(`[migrate] done — ${fixed} row(s) repaired`)
}

main()
  .catch((e) => {
    console.error('[migrate] failed:', e?.message || e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
