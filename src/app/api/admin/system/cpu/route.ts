import os from 'node:os'
import { readFile } from 'node:fs/promises'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let previous: { usage: number; at: number; capacity: number } | null = null

async function readCpuCounters() {
  try {
    const [stat, max] = await Promise.all([
      readFile('/sys/fs/cgroup/cpu.stat', 'utf8'),
      readFile('/sys/fs/cgroup/cpu.max', 'utf8'),
    ])
    const usageLine = stat.split('\n').find((line) => line.startsWith('usage_usec '))
    const usage = Number(usageLine?.split(/\s+/)[1])
    const [quotaRaw, periodRaw] = max.trim().split(/\s+/)
    const capacity = quotaRaw === 'max'
      ? os.availableParallelism?.() ?? os.cpus().length
      : Math.max(0.01, Number(quotaRaw) / Number(periodRaw))
    if (Number.isFinite(usage) && Number.isFinite(capacity)) return { usage, capacity }
  } catch {}

  try {
    const stat = await readFile('/proc/stat', 'utf8')
    const cpuLine = stat.split('\n')[0]
    const values = cpuLine.trim().split(/\s+/).slice(1).map(Number)
    const idle = values[3] + (values[4] || 0)
    return { usage: values.reduce((sum, value) => sum + value, 0) - idle, capacity: 1 }
  } catch {
    return null
  }
}

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const now = Date.now()
  const counters = await readCpuCounters()
  let cpuPct: number | null = null
  if (counters && previous && now > previous.at) {
    const elapsedMs = now - previous.at
    const delta = counters.usage - previous.usage
    const isCgroup = counters.usage > 1_000_000
    const capacity = counters.capacity
    const pct = isCgroup
      ? (delta / (elapsedMs * 1000 * capacity)) * 100
      : (delta / (elapsedMs * os.cpus().length)) * 100
    if (Number.isFinite(pct) && delta >= 0) cpuPct = Math.max(0, Math.min(100, Math.round(pct)))
  }
  if (counters) previous = { ...counters, at: now }

  return Response.json(
    { cpuPct, sampledAt: now },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
