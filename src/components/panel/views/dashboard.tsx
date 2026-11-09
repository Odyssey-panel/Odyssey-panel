'use client'

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
  Zap,
  Boxes,
} from 'lucide-react'

type Stats = {
  clients: { total: number; active: number; expired: number; disabled: number; proxies: number }
  traffic: { usedBytes: number; limitBytes: number }
  nodes: { total: number; up: number; avgLatency: number | null }
  workers: { total: number; up: number }
  baseUrl: string
}

const TINTS = {
  violet: {
    tile: 'bg-violet-500/15 text-violet-400 ring-violet-400/25',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.62_0.22_293/0.55)] group-hover:ring-violet-400/30',
  },
  emerald: {
    tile: 'bg-emerald-500/15 text-emerald-400 ring-emerald-400/25',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.72_0.17_160/0.45)] group-hover:ring-emerald-400/30',
  },
  cyan: {
    tile: 'bg-cyan-500/15 text-cyan-400 ring-cyan-400/25',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.72_0.14_210/0.45)] group-hover:ring-cyan-400/30',
  },
  indigo: {
    tile: 'bg-indigo-500/15 text-indigo-400 ring-indigo-400/25',
    glow: 'group-hover:shadow-[0_12px_44px_-14px_oklch(0.6_0.2_280/0.5)] group-hover:ring-indigo-400/30',
  },
} as const

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
      tint: 'violet',
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
      tint: 'indigo',
      onClick: () => onNavigate('clients'),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="animate-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_8px_oklch(0.62_0.22_293/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300/90">
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

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <button
            key={c.title}
            onClick={c.onClick}
            className="animate-rise group text-start focus-visible:outline-none"
            aria-label={c.title}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <Card
              className={`h-full gap-0 py-0 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-transparent group-hover:ring-1 ${TINTS[c.tint].glow}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                      {c.title}
                    </div>
                    <div className="mt-2 font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums">
                      {c.value}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{c.hint}</div>
                  </div>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 ${TINTS[c.tint].tile}`}
                  >
                    <c.icon className="h-[18px] w-[18px]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Traffic */}
        <Card className="animate-rise" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-inset ring-violet-400/25">
                <Activity className="h-3.5 w-3.5 text-violet-400" />
              </span>
              {t('Traffic allocation')}
            </CardTitle>
            <CardDescription>{t('Sum across all users')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium tabular-nums">
                  {lang === 'fa'
                    ? `${formatBytes(data.traffic.usedBytes)} ${t('used')}`
                    : `${formatBytes(data.traffic.usedBytes)} ${t('used')}`}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {data.traffic.limitBytes > 0 ? `${t('of')} ${formatBytes(data.traffic.limitBytes)}` : t('limits not set')}
                </span>
              </div>
              <Progress value={data.traffic.limitBytes > 0 ? trafficPct : 0} aria-label="Traffic usage" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: t('Proxy accounts'), value: data.clients.proxies },
                { label: t('Nodes healthy'), value: `${nodesPct}%` },
                { label: t('Subscriptions'), value: data.clients.total },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-white/[0.03] p-3 text-center transition-colors hover:bg-white/[0.06] dark:bg-white/[0.03]"
                >
                  <div className="font-display text-xl font-semibold tabular-nums">{s.value}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Panel URL */}
        <Card className="animate-rise" style={{ animationDelay: '270ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-inset ring-cyan-400/25">
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
                <Zap className="h-4 w-4" /> {t('Go to settings')}
              </Button>
            </div>
            {!botConfigured && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('Tip: after deploying to your final domain, the URL is auto-detected the first time you sign in.')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="animate-rise" style={{ animationDelay: '340ms' }}>
        <CardHeader className="pb-4">
          <CardTitle className="text-[15px]">{t('Quick actions')}</CardTitle>
          <CardDescription>{t('Create a user, check your servers or scan a host — everything from one place.')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5 sm:grid-cols-3">
          {[
            { label: t('New user'), desc: t('Subscribers, traffic limits, expiry and subscription links'), view: 'clients' as ViewKey, icon: Users, tint: 'violet' as const },
            { label: t('Check nodes'), desc: t('Backend servers and worker endpoints with simple TCP/TLS/HTTP health checks — auto-refreshed every 5 minutes'), view: 'nodes' as ViewKey, icon: Server, tint: 'emerald' as const },
            { label: t('Open scanner'), desc: t('Check IPs, ports, TLS/SNI and basic HTTP info. Tap any value to copy.'), view: 'scanner' as ViewKey, icon: Radar, tint: 'cyan' as const },
          ].map((a) => (
            <button
              key={a.view}
              onClick={() => onNavigate(a.view)}
              className="group flex items-start gap-3 rounded-xl border bg-white/[0.02] p-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.05] dark:bg-white/[0.03]"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${TINTS[a.tint].tile}`}>
                <a.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{a.label}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{a.desc}</span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
