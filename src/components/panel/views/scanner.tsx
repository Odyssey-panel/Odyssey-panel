'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { CopyButton, CopyField } from '../copy'
import { StatusBadge } from '../status-badge'
import { api } from '../api'
import { formatDateTime } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { parseVlessUri, runDeviceTest, type TunnelTestResult } from '@/lib/selftest'
import { toast } from 'sonner'
import { Radar, Loader2, FileJson, TextQuote, Globe, Smartphone, ExternalLink, Activity, CheckCircle2, XCircle } from 'lucide-react'

type ScanResult = {
  port: number
  tcp: { open: boolean; latencyMs?: number; error?: string }
  tls?: {
    ok: boolean
    latencyMs?: number
    error?: string
    subject?: string
    issuer?: string
    validFrom?: string
    validTo?: string
    daysLeft?: number
    sans?: string[]
    authorized?: boolean
  }
  http?: { ok: boolean; latencyMs?: number; httpStatus?: number; title?: string; server?: string; error?: string }
}

type ScanResponse = {
  host: string
  sni: string | null
  scannedAt: string
  results: ScanResult[]
}

export function ScannerView() {
  const [host, setHost] = useState('')
  const [ports, setPorts] = useState('443')
  const [sni, setSni] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResponse | null>(null)
  const { t, lang } = useLang()

  const scan = async () => {
    if (!host.trim()) {
      toast.error(t('Enter a host or IP'))
      return
    }
    setBusy(true)
    try {
      const res = await api<ScanResponse>('/api/admin/scan', {
        method: 'POST',
        body: JSON.stringify({ host: host.trim(), ports, sni: sni.trim() || undefined }),
      })
      setResult(res)
      toast.success(t('Scanned {n} port(s)', { n: res.results.length }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Scan failed'))
    } finally {
      setBusy(false)
    }
  }

  const copyAllText = (r: ScanResponse): string => {
    const lines = [`${t('Scan of {host}', { host: r.host })}${r.sni ? ` (SNI ${r.sni})` : ''} — ${formatDateTime(r.scannedAt, lang)}`, '']
    for (const item of r.results) {
      lines.push(`${t('Ports')} ${item.port}: ${item.tcp.open ? t('OPEN') : t('CLOSED')}${item.tcp.latencyMs ? ` (${item.tcp.latencyMs} ms)` : ''}${item.tcp.error ? ` — ${item.tcp.error}` : ''}`)
      if (item.tls?.ok) {
        lines.push(`  TLS: ✓ ${item.tls.subject} · ${t('Issuer')} ${item.tls.issuer} · ${t('{d}d left', { d: item.tls.daysLeft ?? 0 })} (${item.tls.validTo?.slice(0, 10)})`)
        if (item.tls.sans?.length) lines.push(`  SANs: ${item.tls.sans.join(', ')}`)
      } else if (item.tls) {
        lines.push(`  TLS: ✗ ${item.tls.error}`)
      }
      if (item.http?.httpStatus) {
        lines.push(`  HTTP: ${item.http.httpStatus}${item.http.server ? ` · ${t('Server header')} ${item.http.server}` : ''}${item.http.title ? ` · "${item.http.title}"` : ''}`)
      }
    }
    return lines.join('\n')
  }

  const copyJson = (r: ScanResponse): string => JSON.stringify(r, null, 2)

  return (
    <div className="animate-rise space-y-6">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-odyssey-navy to-odyssey-cyan shadow-[0_0_8px_oklch(0.72_0.1_214/0.9)]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-odyssey-cyan/90">
            {t('Diagnostics')}
          </span>
        </div>
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">{t('Scanner')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Check IPs, ports, TLS/SNI and basic HTTP info. Tap any value to copy.')}
        </p>
      </div>

      {/* ── device self-test: proves the config works from THIS device ── */}
      <DeviceTestCard />

      {/* ── ready-made scanner sites & tools ── */}
      <ReadySitesCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="h-4 w-4 text-primary" /> {t('Target')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-host">{t('Host / IP *')}</Label>
              <Input
                id="s-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="example.com or 1.2.3.4"
                dir="ltr"
                onKeyDown={(e) => e.key === 'Enter' && void scan()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-ports">{t('Ports')}</Label>
              <Input
                id="s-ports"
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                placeholder="443, 2053, 8000-8010"
                dir="ltr"
                onKeyDown={(e) => e.key === 'Enter' && void scan()}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-sni">{t('SNI / domain')}</Label>
              <Input id="s-sni" value={sni} onChange={(e) => setSni(e.target.value)} placeholder={t('optional')} dir="ltr" />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button onClick={() => void scan()} disabled={busy || !host.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                {t('Scan')}
              </Button>
              <span className="pb-1 text-xs text-muted-foreground">{t('up to 64 ports per scan')}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="py-1.5 text-muted-foreground">{t('Quick fills')}:</span>
            {[
              { label: t('This panel (built-in backend)'), host: typeof window !== 'undefined' ? window.location.hostname : '', ports: '443', sni: typeof window !== 'undefined' ? window.location.hostname : '' },
              { label: 'cloudflare 443', host: 'cloudflare.com', ports: '443', sni: '' },
              { label: 'CF clean ports', host: 'cloudflare.com', ports: '443, 2053, 2083, 2087, 2096, 8443', sni: '' },
              { label: 'google.com', host: 'google.com', ports: '80, 443', sni: '' },
              { label: 'github.com', host: 'github.com', ports: '22, 80, 443', sni: '' },
            ].map((q) => (
              <Button
                key={q.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setHost(q.host)
                  setPorts(q.ports)
                  setSni(q.sni)
                }}
              >
                {q.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {busy && (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      )}

      {result && !busy && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold" dir="ltr">
                  {result.host}
                  {result.sni ? <span className="text-muted-foreground"> · SNI {result.sni}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(result.scannedAt, lang)} · {result.results.length} {t('ports')}</div>
              </div>
              <div className="flex gap-2">
                <CopyButton value={copyAllText(result)} label={t('Copy all as text')} />
                <CopyButton value={copyJson(result)} label={t('Copy JSON')} />
              </div>
            </CardContent>
          </Card>

          {result.results.map((item) => (
            <PortCard key={item.port} item={item} host={result.host} />
          ))}
        </div>
      )}
    </div>
  )
}

function PortCard({ item, host }: { item: ScanResult; host: string }) {
  const [showJson, setShowJson] = useState(false)
  const { t } = useLang()
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-mono text-base" dir="ltr">
            {host}<span className="text-muted-foreground">:</span>{item.port}
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge kind={item.tcp.open ? 'up' : 'down'} label={item.tcp.open ? t('OPEN') : t('CLOSED')} />
            {item.tcp.latencyMs !== undefined && <span className="text-xs text-muted-foreground">⚡ {item.tcp.latencyMs} ms</span>}
            <CopyButton value={JSON.stringify(item, null, 2)} size="icon" className="h-8 w-8" />
          </div>
        </div>
        <CardDescription>
          {item.tcp.open ? t('TCP connection succeeded') : t('TCP failed — {err}', { err: item.tcp.error || t('no response') })}
        </CardDescription>
      </CardHeader>
      {item.tcp.open && (
        <CardContent className="space-y-3">
          {item.tls?.ok ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t('TLS / SNI')}</span>
                <StatusBadge kind={item.tls.authorized ? 'green' : 'amber'} label={item.tls.authorized ? t('valid chain') : t('self-signed / untrusted')} />
              </div>
              <CopyField label={t('Subject (CN)')} value={item.tls.subject || '—'} />
              <div className="grid gap-3 sm:grid-cols-2">
                <CopyField label={t('Issuer')} value={item.tls.issuer || '—'} />
                <CopyField
                  label={t('Expires')}
                  value={`${item.tls.validTo?.slice(0, 10) || '—'} (${t('{d}d left', { d: item.tls.daysLeft ?? 0 })})`}
                  mono={false}
                />
              </div>
              <CopyField label={t('SANs (domains on cert)')} value={item.tls.sans?.join(', ') || '—'} />
              <div className="grid gap-3 sm:grid-cols-2">
                <CopyField label={t('Valid from')} value={item.tls.validFrom?.slice(0, 19).replace('T', ' ') || '—'} mono={false} />
                <CopyField label={t('Handshake latency')} value={`${item.tls.latencyMs ?? '—'} ms`} mono={false} />
              </div>
            </>
          ) : item.tls && !item.tls.ok ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t('TLS / SNI')}</span>
                <StatusBadge kind="red" label={t('handshake failed')} />
              </div>
              <p className="text-xs text-muted-foreground">{item.tls.error}</p>
            </>
          ) : null}

          {item.http && item.http.httpStatus ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t('HTTP probe')}</span>
                <StatusBadge kind={item.http.ok ? 'green' : 'amber'} label={`HTTP ${item.http.httpStatus}`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CopyField label={t('Server header')} value={item.http.server || '—'} />
                <CopyField label={t('Page title')} value={item.http.title || '—'} mono={false} />
              </div>
            </>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowJson((s) => !s)}>
              {showJson ? <TextQuote className="h-3.5 w-3.5" /> : <FileJson className="h-3.5 w-3.5" />}
              {showJson ? t('Hide raw') : t('Raw result')}
            </Button>
            <CopyButton value={`host: ${host}\nport: ${item.port}\ntcp: ${item.tcp.open ? 'open' : 'closed'}`} label={t('Copy summary')} />
          </div>
          {showJson && (
            <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(item, null, 2)}
            </pre>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ── device self-test ─────────────────────────────────────────────────────────


function DeviceTestCard() {
  const { t } = useLang()
  const [uri, setUri] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TunnelTestResult | null>(null)

  const run = async () => {
    const target = parseVlessUri(uri)
    if (!target) {
      toast.error(t('Paste a valid vless:// link (tls + ws)'))
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const r = await runDeviceTest(target)
      setResult(r)
      if (r.ok) toast.success(t('Config works from this device 🎉'))
    } finally {
      setBusy(false)
    }
  }

  const advice = (verdict: string): string => {
    if (verdict === 'ok') return t('Everything passed — if the VPN app still fails, update the app (v2rayNG ≥ 1.8.16) or re-import the config.')
    if (verdict === 'https-blocked') return t('This domain is blocked on your current network. Try another network / ISP, or add a fragment preset (Anti-filter tab).')
    if (verdict === 'ws-blocked') return t('The site opens but the tunnel path is blocked here. Switch network or use the fragment presets, then test again.')
    return t('Connection reached the server but the tunnel data did not return. Re-import the config into the VPN app and test again.')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" /> {t('Test from this device')}
        </CardTitle>
        <CardDescription>
          {t('Paste the vless:// link and run a real tunnel handshake from your phone — no VPN app needed.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="vless://…"
            dir="ltr"
            className="font-mono text-xs"
            onKeyDown={(e) => e.key === 'Enter' && void run()}
          />
          <Button onClick={() => void run()} disabled={busy || !uri.trim()} className="shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            {t('Run test')}
          </Button>
        </div>

        {result && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              {result.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <StatusBadge
                kind={result.ok ? 'green' : 'red'}
                label={result.ok ? t('Tunnel works') : t('Blocked on this network')}
              />
              {result.ok && result.steps[2]?.latencyMs !== undefined && (
                <span className="text-xs text-muted-foreground">⚡ {result.steps[2].latencyMs} ms</span>
              )}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {result.steps.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
                  <span className="font-mono">{s.label}</span>
                  <span className="flex items-center gap-1.5">
                    {s.latencyMs !== undefined && s.state === 'ok' && (
                      <span className="text-muted-foreground">{s.latencyMs} ms</span>
                    )}
                    {s.state === 'ok' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{advice(result.verdict)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── ready-made scanner sites ─────────────────────────────────────────────────

function ReadySitesCard() {
  const { t } = useLang()
  const sites = [
    {
      name: 'check-host.net',
      url: 'https://check-host.net/check-tcp',
      desc: t('TCP/port reachability from many countries — the closest thing to testing from outside Iran'),
    },
    {
      name: 'ping.pe',
      url: 'https://ping.pe',
      desc: t('Ping, port and traceroute of any host from dozens of locations worldwide'),
    },
    {
      name: 'CloudflareSpeedTest',
      url: 'https://github.com/XIU2/CloudflareSpeedTest',
      desc: t('The famous Cloudflare clean-IP scanner — find fast IPs, then put the best one in the config address'),
    },
    {
      name: 'Cloudflare IP ranges',
      url: 'https://www.cloudflare.com/ips/',
      desc: t('Official Cloudflare IP ranges — feed them into the scanner as input'),
    },
    {
      name: 'speed.cloudflare.com',
      url: 'https://speed.cloudflare.com/',
      desc: t('Official Cloudflare speed test — measure latency/throughput per region'),
    },
    {
      name: 'bgp.he.net',
      url: 'https://bgp.he.net/',
      desc: t('BGP/ASN lookup — see who hosts an IP and how it routes'),
    },
  ]
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" /> {t('Ready scanner sites')}
        </CardTitle>
        <CardDescription>{t('Trusted, ready-to-use tools for reachability, clean-IP hunting and routing info.')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {sites.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2.5 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold" dir="ltr">{s.name}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
