import os from 'node:os'
import { db } from '@/lib/db'
import { requireAuth, jsonSafe } from '@/lib/auth'
import { getBaseUrl } from '@/lib/settings'

export const runtime = 'nodejs'

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const [clients, nodes, workers, proxyCount, protocolGroups] = await Promise.all([
    db.client.findMany(),
    db.node.findMany({ select: { status: true, latencyMs: true } }),
    db.worker.findMany({ select: { status: true, latencyMs: true } }),
    db.proxy.count(),
    db.proxy.groupBy({ by: ['protocol'], _count: { _all: true } }),
  ])

  const now = Date.now()
  const active = clients.filter(
    (c) => c.status === 'active' && (!c.expiresAt || c.expiresAt.getTime() > now)
  ).length
  const expired = clients.filter((c) => c.expiresAt && c.expiresAt.getTime() <= now && c.status === 'active').length
  const disabled = clients.filter((c) => c.status !== 'active').length
  const usedBytes = clients.reduce((acc, c) => acc + c.usedBytes, BigInt(0))
  const limitBytes = clients.reduce((acc, c) => acc + c.limitBytes, BigInt(0))
  const latencies = nodes.filter((n) => n.latencyMs).map((n) => n.latencyMs as number)

  // Live container stats (RAM / uptime) — labeled "RAM" in the dashboard
  const ramTotal = os.totalmem()
  const ramUsed = ramTotal - os.freemem()

  return jsonSafe({
    clients: { total: clients.length, active, expired, disabled, proxies: proxyCount },
    traffic: { usedBytes: Number(usedBytes), limitBytes: Number(limitBytes) },
    nodes: {
      total: nodes.length,
      up: nodes.filter((n) => n.status === 'up').length,
      avgLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    },
    workers: {
      total: workers.length,
      up: workers.filter((w) => w.status === 'up').length,
    },
    protocols: Object.fromEntries(protocolGroups.map((g) => [g.protocol, g._count._all])),
    system: {
      ramUsed,
      ramTotal,
      ramPct: ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0,
      uptimeS: Math.round(os.uptime()),
      platform: `${os.type()} ${os.arch()}`,
    },
    baseUrl: await getBaseUrl(),
  })
}
