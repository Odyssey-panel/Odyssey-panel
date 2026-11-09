'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { CopyButton, CopyField } from '../copy'
import { StatusBadge } from '../status-badge'
import { api } from '../api'
import { formatDateTime } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { toast } from 'sonner'
import { Radar, Loader2, FileJson, TextQuote } from 'lucide-react'

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
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_8px_oklch(0.62_0.22_293/0.9)]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300/90">
            {t('Diagnostics')}
          </span>
        </div>
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">{t('Scanner')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Check IPs, ports, TLS/SNI and basic HTTP info. Tap any value to copy.')}
        </p>
      </div>

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
