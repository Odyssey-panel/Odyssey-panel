'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '../copy'
import { useApi } from '../api'
import { formatBytes } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import type { ViewKey } from '../panel'
import {
  Users,
  Server,
  Globe,
  Plus,
  Radar,
  RefreshCw,
  Link2,
  Activity,
  Boxes,
  Shield,
  Cpu,
  Layers,
} from 'lucide-react'

type Stats = {
  clients: { total: number; active: number; expired: number; disabled: number; proxies: number }
  traffic: { usedBytes: number; limitBytes: number }
  nodes: { total: number; up: number; avgLatency: number | null }
  workers: { total: number; up: number }
  protocols: Record<string, number>
  system: { ramUsed: number; ramTotal: number; ramPct: number; uptimeS: number; platform: string }
  baseUrl: string
}

const TINTS = {
  navy: {
    tile: 'bg-odyssey-navy/15 text-odyssey-navy ring-odyssey-navy/25 dark:text-odyssey-bright',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.35_0.058_248/0.5)] group-hover:ring-odyssey-navy/30',
  },
  emerald: {
    tile: 'bg-emerald-500/15 text-emerald-400 ring-emerald-400/25',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.72_0.17_160/0.45)] group-hover:ring-emerald-400/30',
  },
  cyan: {
    tile: 'bg-odyssey-cyan/15 text-cyan-600 ring-odyssey-cyan/30 dark:text-odyssey-bright',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.72_0.1_214/0.5)] group-hover:ring-odyssey-cyan/35',
  },
  silver: {
    tile: 'bg-odyssey-silver/20 text-slate-600 ring-odyssey-silver/30 dark:text-odyssey-silver',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.6_0.02_240/0.45)] group-hover:ring-odyssey-silver/35',
  },
} as const

/** Animated number that eases from 0 to its target on mount/change. */
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    const t0 = performance.now()
    const dur = 700
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return (
    <span className="tabular-nums">
      {n}
      {suffix}
    </span>
  )
}

function uptimeLabel(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((sec % 3600) / 60)}m`
}

export function DashboardView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { data, loading, reload } = useApi<Stats>('/api/admin/stats')
  const { t, lang } = useLang()

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (!data) return null

  const trafficPct = data.traffic.limitBytes > 0 ? Math.min(100, (data.traffic.usedBytes / data.traffic.limitBytes) * 100) : 0
  const nodesPct = data.nodes.total ? Math.round((data.nodes.up / data.nodes.total) * 100) : 0
  const botConfigured = data.baseUrl ? true : false
  const ramPct = data.system?.ramPct ?? 0

  const cards: {
    title: string
    value: string
    hint: string
    icon: typeof Users
    tint: keyof typeof TINTS
    onClick: () => void
  }[] = [
    {
      title: t('Active users'),
      value: `${data.clients.active}/${data.clients.total}`,
      hint: `${data.clients.expired} ${t('expired')} · ${data.clients.disabled} ${t('disabled')}`,
      icon: Users,
      tint: 'navy',
      onClick: () => onNavigate('clients'),
    },
    {
      title: t('Nodes online'),
      value: `${data.nodes.up}/${data.nodes.total}`,
      hint: data.nodes.avgLatency !== null ? `${t('avg')} ${data.nodes.avgLatency} ms` : t('run a health check'),
      icon: Server,
      tint: 'emerald',
      onClick: () => onNavigate('nodes'),
    },
    {
      title: t('Workers online'),
      value: `${data.workers.up}/${data.workers.total}`,
      hint: t('Cloudflare workers & endpoints'),
      icon: Globe,
      tint: 'cyan',
      onClick: () => onNavigate('nodes'),
    },
    {
      title: t('Proxy accounts'),
      value: String(data.clients.proxies),
      hint: t('all proxy accounts'),
      icon: Boxes,
      tint: 'silver',
      onClick: () => onNavigate('clients'),
    },
  ]

  const protocolEntries = Object.entries(data.protocols || {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="animate-rise relative overflow-hidden rounded-2xl border bg-gradient-to-l from-odyssey-navy/[0.06] via-transparent to-odyssey-cyan/[0.08] p-5 md:p-6">
        <div className="animate-float pointer-events-none absolute -top-24 -start-16 h-56 w-56 rounded-full bg-odyssey-cyan/15 blur-[70px]" />
        <div className="animate-float-slow pointer-events-none absolute -bottom-28 -end-10 h-56 w-56 rounded-full bg-odyssey-navy/15 blur-[80px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="animate-breathe h-1.5 w-1.5 rounded-full bg-gradient-to-r from-odyssey-navy to-odyssey-cyan shadow-[0_0_8px_oklch(0.72_0.1_214/0.9)]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-odyssey-cyan/90">
                {t('Overview')}
              </span>
            </div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">
              {t('Hello, sir 👋')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Here’s what’s happening with your network today.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="h-4 w-4" /> {t('Refresh')}
            </Button>
            <Button size="sm" onClick={() => onNavigate('clients')}>
              <Plus className="h-4 w-4" /> {t('New user')}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <button
            key={c.title}
            onClick={c.onClick}
            className="animate-pop group text-start focus-visible:outline-none"
            aria-label={c.title}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Card
              className={`lift h-full gap-0 overflow-hidden py-0 transition-all duration-300 group-hover:border-transparent group-hover:ring-1 ${TINTS[c.tint].glow}`}
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-odyssey-navy/60 via-odyssey-cyan/60 to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                      {c.title}
                    </div>
                    <div className="mt-2 font-display text-[32px] font-semibold leading-none tracking-tight">
                      {c.value}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{c.hint}</div>
                  </div>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl rounded-tr-sm ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${TINTS[c.tint].tile}`}
                  >
                    <c.icon className="h-[18px] w-[18px]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── RAM / System ── */}
        <Card className="animate-pop" style={{ animationDelay: '220ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-2xl rounded-tl-sm bg-odyssey-navy/15 ring-1 ring-inset ring-odyssey-navy/25">
                <Cpu className="h-3.5 w-3.5 text-odyssey-navy dark:text-odyssey-bright" />
              </span>
              RAM
            </CardTitle>
            <CardDescription>{t('Live memory usage of the panel container')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div className="font-display text-2xl font-semibold tabular-nums">
                <CountUp value={ramPct} suffix="%" />
              </div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {formatBytes(data.system?.ramUsed ?? 0)} / {formatBytes(data.system?.ramTotal ?? 0)}
              </div>
            </div>
            <Progress value={ramPct} aria-label="RAM usage" className="progress-gradient" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-mono" dir="ltr">{data.system?.platform || '—'}</span>
              <span dir="ltr">
                {t('Uptime')} <span className="font-mono">· {uptimeLabel(data.system?.uptimeS ?? 0)}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Protocols ── */}
        <Card className="animate-pop" style={{ animationDelay: '290ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-2xl rounded-tr-sm bg-cyan-500/15 ring-1 ring-inset ring-cyan-400/25">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
              </span>
              {t('Protocols')}
            </CardTitle>
            <CardDescription>{t('Active protocols across all accounts')}</CardDescription>
          </CardHeader>
          <CardContent>
            {protocolEntries.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                {t('No accounts yet — create one to see the breakdown')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {protocolEntries.map(([proto, count], i) => (
                  <button
                    key={proto}
                    onClick={() => onNavigate('clients')}
                    className="animate-pop group flex items-center gap-1.5 rounded-full border bg-white/[0.03] px-2.5 py-1 text-xs transition-all hover:-translate-y-0.5 hover:border-odyssey-cyan/40 hover:bg-odyssey-cyan/10 dark:bg-white/[0.04]"
                    style={{ animationDelay: `${330 + i * 60}ms` }}
                  >
                    <span className="font-mono font-semibold uppercase tracking-wide">{proto}</span>
                    <span className="rounded-full bg-odyssey-navy/10 px-1.5 text-[10px] font-bold tabular-nums text-odyssey-navy dark:bg-odyssey-cyan/15 dark:text-odyssey-bright">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Traffic ── */}
        <Card className="animate-pop" style={{ animationDelay: '360ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-2xl rounded-bl-sm bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/25">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
              </span>
              {t('Traffic allocation')}
            </CardTitle>
            <CardDescription>{t('Sum across all users')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium tabular-nums">
                  {formatBytes(data.traffic.usedBytes)} {t('used')}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {data.traffic.limitBytes > 0 ? `${t('of')} ${formatBytes(data.traffic.limitBytes)}` : t('limits not set')}
                </span>
              </div>
              <Progress value={trafficPct} aria-label="Traffic usage" className="progress-gradient" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border bg-white/[0.03] p-2.5 text-center transition-colors hover:bg-white/[0.06] dark:bg-white/[0.03]">
                <div className="font-display text-lg font-semibold tabular-nums">{nodesPct}%</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{t('Nodes healthy')}</div>
              </div>
              <div className="rounded-xl border bg-white/[0.03] p-2.5 text-center transition-colors hover:bg-white/[0.06] dark:bg-white/[0.03]">
                <div className="font-display text-lg font-semibold tabular-nums">{data.clients.total}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{t('Subscriptions')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Panel URL ── */}
        <Card className="animate-pop" style={{ animationDelay: '430ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-2xl rounded-tl-sm bg-cyan-500/15 ring-1 ring-inset ring-cyan-400/25">
                <Link2 className="h-3.5 w-3.5 text-cyan-400" />
              </span>
              {t('Panel URL')}
            </CardTitle>
            <CardDescription>{t('Base URL used in subscription links & QR codes')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border bg-white/[0.04] px-3 py-2 font-mono text-xs dark:bg-white/[0.04]">
                {data.baseUrl || t('Not detected yet — open the panel once, or set it in Settings')}
              </code>
              {data.baseUrl && <CopyButton value={data.baseUrl} size="icon" className="h-9 w-9" />}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('Subscription links are relative paths under this origin, so they keep working after you move the deployment to its final domain. You can also pin an explicit URL in Settings.')}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onNavigate('scanner')}>
                <Radar className="h-4 w-4" /> {t('Open scanner')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate('settings')}>
                <Shield className="h-4 w-4" /> {t('Go to settings')}
              </Button>
            </div>
            {!botConfigured && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('Tip: after deploying to your final domain, the URL is auto-detected the first time you sign in.')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Quick actions ── */}
        <Card className="animate-pop" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-[15px]">{t('Quick actions')}</CardTitle>
            <CardDescription>{t('Create a user, check your servers or scan a host — everything from one place.')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {[
              { label: t('New user'), desc: t('Subscribers, traffic limits, expiry and subscription links'), view: 'clients' as ViewKey, icon: Users, tint: 'navy' as const },
              { label: t('Anti-filter'), desc: t('Fragment & operator presets for Iranian ISPs'), view: 'antifilter' as ViewKey, icon: Shield, tint: 'cyan' as const },
              { label: t('Check nodes'), desc: t('Backend servers and worker endpoints with simple TCP/TLS/HTTP health checks — auto-refreshed every 5 minutes'), view: 'nodes' as ViewKey, icon: Server, tint: 'emerald' as const },
              { label: t('Open scanner'), desc: t('Check IPs, ports, TLS/SNI and basic HTTP info. Tap any value to copy.'), view: 'scanner' as ViewKey, icon: Radar, tint: 'silver' as const },
            ].map((a) => (
              <button
                key={a.view}
                onClick={() => onNavigate(a.view)}
                className="group flex items-start gap-3 rounded-xl border bg-white/[0.02] p-3 text-start transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.05] dark:bg-white/[0.03]"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl rounded-tl-sm ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${TINTS[a.tint].tile}`}>
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{a.label}</span>
                  <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{a.desc}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
