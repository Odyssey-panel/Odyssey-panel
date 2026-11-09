/**
 * Background scheduler started once per server instance via instrumentation.ts.
 * Handles: periodic node/worker auto health checks.
 */
import { checkAllNodes, checkAllWorkers } from '@/lib/health'

const g = globalThis as unknown as { __panelJobsStarted?: boolean; __panelLastAutoCheck?: number }

const HEALTH_INTERVAL_MS = 5 * 60 * 1000 // every 5 minutes

async function tick() {
  // Periodic health checks
  const now = Date.now()
  if (!g.__panelLastAutoCheck || now - g.__panelLastAutoCheck > HEALTH_INTERVAL_MS) {
    g.__panelLastAutoCheck = now
    try {
      await Promise.allSettled([checkAllNodes(), checkAllWorkers()])
    } catch (e) {
      console.error('[jobs] auto health check failed', e)
    }
  }
}

export function startJobs() {
  if (g.__panelJobsStarted) return
  g.__panelJobsStarted = true

  void (async () => {
    for (;;) {
      try {
        await tick()
      } catch (e) {
        console.error('[jobs] tick error', e)
      }
      await new Promise((r) => setTimeout(r, 10000))
    }
  })()

  console.log('[jobs] background scheduler started')
}
