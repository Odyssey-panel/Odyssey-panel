import os from 'node:os'
import { readFile } from 'node:fs/promises'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CpuCounters =
  | { kind: 'cgroup'; usage: number; capacity: number }
  | { kind: 'proc'; total: number; idle: number }

let previous: { counters: CpuCounters; at: number } | null = null

async function readCpuCounters(): Promise<CpuCounters | null> {
  try {
    const [stat, max] = await Promise.all([
      readFile('/sys/fs/cgroup/cpu.stat', 'utf8'),
      readFile('/sys/fs/cgroup/cpu.max', 'utf8'),
    ])
    const usageLine = stat.split('\n').find((line) => line.startsWith('usage_usec '))
    const usage = Number(usageLine?.split(/\s+/)[1])
    const [quotaRaw, periodRaw] = max.trim().split(/\s+/)
    const capacity = quotaRaw === 'max'
      ? (os.availableParallelism?.() ?? os.cpus().length)
      : Math.max(0.01, Number(quotaRaw) / Number(periodRaw))
    if (Number.isFinite(usage) && Number.isFinite(capacity)) {
      return { kind: 'cgroup', usage, capacity }
    }
  } catch {}

  try {
    const stat = await readFile('/proc/stat', 'utf8')
    const values = stat.split('\n')[0].trim().split(/\s+/).slice(1).map(Number)
    const total = values.reduce((sum, value) => sum + value, 0)
    const idle = values[3] + (values[4] || 0)
    if (Number.isFinite(total) && Number.isFinite(idle)) return { kind: 'proc', total, idle }
  } catch {}
  return null
}

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const now = Date.now()
  const counters = await readCpuCounters()
  let cpuPct: number | null = null

  if (counters && previous && counters.kind === previous.counters.kind && now > previous.at) {
    if (counters.kind === 'cgroup' && previous.counters.kind === 'cgroup') {
      const elapsedMs = now - previous.at
      const delta = counters.usage - previous.counters.usage
      const pct = (delta / (elapsedMs * 1000 * counters.capacity)) * 100
      if (delta >= 0 && Number.isFinite(pct)) cpuPct = Math.max(0, Math.min(100, Math.round(pct)))
    } else if (counters.kind === 'proc' && previous.counters.kind === 'proc') {
      const deltaTotal = counters.total - previous.counters.total
      const deltaIdle = counters.idle - previous.counters.idle
      if (deltaTotal > 0) cpuPct = Math.max(0, Math.min(100, Math.round(((deltaTotal - deltaIdle) / deltaTotal) * 100)))
    }
  }
  if (counters) previous = { counters, at: now }

  return Response.json(
    { cpuPct, sampledAt: now },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
