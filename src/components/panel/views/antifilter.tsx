'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '../copy'
import { api, useApi } from '../api'
import { useLang } from '@/lib/i18n'
import { toast } from 'sonner'
import { ISP_PRESETS, mergeIspOverrides, type IspPreset } from '@/lib/isps'
import { addressKind } from '@/lib/links'
import {
  Shield,
  Loader2,
  RotateCcw,
  Save,
  Zap,
  Globe,
  Info,
} from 'lucide-react'

const DEFAULTS: Record<string, IspPreset> = Object.fromEntries(ISP_PRESETS.map((p) => [p.id, p]))

export function AntiFilterView() {
  const { data, loading } = useApi<{ settings: Record<string, string> }>('/api/admin/settings')
  const [presets, setPresets] = useState<Record<string, IspPreset> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { t } = useLang()

  // hydrate local editable copy once the saved settings arrive
  if (!presets && data?.settings) {
    let saved: Record<string, Partial<IspPreset>> | null = null
    try {
      saved = data.settings.ispPresets ? JSON.parse(data.settings.ispPresets) : null
    } catch {}
    setPresets(Object.fromEntries(mergeIspOverrides(saved).map((p) => [p.id, p])))
  }

  const patch = (id: string, key: keyof IspPreset, value: string) => {
    setPresets((prev) => (prev ? { ...prev, [id]: { ...prev[id], [key]: value } } : prev))
  }

  const savePreset = async (id: string) => {
    if (!presets) return
    const p = presets[id]
    setBusyId(id)
    try {
      // store only the override for this ISP (others stay on defaults)
      let current: Record<string, Partial<IspPreset>> = {}
      const res = await api<{ settings: Record<string, string> }>('/api/admin/settings')
      if (res.settings?.ispPresets) {
        try { current = JSON.parse(res.settings.ispPresets) } catch {}
      }
      const next: Record<string, Partial<IspPreset>> = { ...current, [id]: p }
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ ispPresets: JSON.stringify(next) }) })
      toast.success(t('Preset saved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    } finally {
      setBusyId(null)
    }
  }

  const applyAll = async (id: string) => {
    if (!presets) return
    const p = presets[id]
    const fragment = `${p.length},${p.interval},${p.packets}`
    setBusyId(id)
    try {
      const res = await api<{ updated: number }>('/api/admin/proxies/apply-all', {
        method: 'POST',
        body: JSON.stringify({ fragment }),
      })
      toast.success(t('Applied to {n} accounts', { n: res.updated }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    } finally {
      setBusyId(null)
    }
  }

  const resetOne = (id: string) => {
    setPresets((prev) => (prev ? { ...prev, [id]: { ...DEFAULTS[id] } } : prev))
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="animate-breathe h-1.5 w-1.5 rounded-full bg-gradient-to-r from-odyssey-navy to-odyssey-cyan shadow-[0_0_8px_oklch(0.72_0.1_214/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-odyssey-cyan/90">
              {t('Anti-filter')}
            </span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">
            {t('Anti-filter')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('Fragment & operator presets for Iranian ISPs')}</p>
        </div>
        <Shield className="h-10 w-10 text-odyssey-cyan/60" />
      </div>

      {/* Explainer */}
      <Card className="aurora-edge animate-pop overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-2xl rounded-tr-sm bg-odyssey-cyan/15 ring-1 ring-inset ring-odyssey-cyan/30">
              <Info className="h-3.5 w-3.5 text-odyssey-cyan dark:text-odyssey-bright" />
            </span>
            {t('What is fragment?')}
          </CardTitle>
          <CardDescription className="leading-relaxed">{t('Fragment splits the TLS handshake into small pieces so the filtering boxes cannot read the SNI — blocked CDN domains become reachable again on many Iranian ISPs. These values are editable defaults; tune them for your own line.')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{t('Enable manually in your client')} — </span>
            {t('Hiddify: Settings → All Config Options → TLS Fragment · v2rayNG: Settings → Fragment · Streisand: tap the config → Fragment. Paste the same values there.')}
          </p>
        </CardContent>
      </Card>

      {/* ISP presets */}
      {loading || !presets ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ISP_PRESETS.map((def, i) => {
            const p = presets[def.id] || def
            const fragment = `${p.length},${p.interval},${p.packets}`
            return (
              <Card key={def.id} className="animate-pop" style={{ animationDelay: `${i * 70}ms` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-[15px]">{p.name}</CardTitle>
                    <span className="rounded-full bg-odyssey-navy/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-odyssey-navy dark:bg-odyssey-cyan/15 dark:text-odyssey-bright" dir="ltr">
                      {p.nameEn}
                    </span>
                  </div>
                  <CardDescription className="line-clamp-2 leading-relaxed">{p.note}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('Length')}</Label>
                      <Input value={p.length} onChange={(e) => patch(def.id, 'length', e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('Interval')}</Label>
                      <Input value={p.interval} onChange={(e) => patch(def.id, 'interval', e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('Packets')}</Label>
                      <Input value={p.packets} onChange={(e) => patch(def.id, 'packets', e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('Recommended port')}</Label>
                      <Input value={p.port} onChange={(e) => patch(def.id, 'port', e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('Recommended transport')}</Label>
                      <Input value={p.transport} onChange={(e) => patch(def.id, 'transport', e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('Recommended SNI')}</Label>
                      <Input value={p.sni} onChange={(e) => patch(def.id, 'sni', e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 py-1.5" dir="ltr">
                      <p className="truncate font-mono text-[11px] text-muted-foreground">fragment={fragment}</p>
                    </div>
                    <CopyButton value={`fragment=${fragment}`} label={t('Copy fragment')} className="shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" className="h-8 flex-1" onClick={() => void savePreset(def.id)} disabled={busyId === def.id}>
                      {busyId === def.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('Save preset')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => void applyAll(def.id)} disabled={busyId === def.id}>
                      <Zap className="h-3.5 w-3.5" /> {t('Apply to all accounts')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" aria-label={t('Reset to default')} onClick={() => resetOne(def.id)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Address helper */}
      <AddressHelper />
    </div>
  )
}

function AddressHelper() {
  const [value, setValue] = useState('')
  const { t } = useLang()
  const kind = addressKind(value)
  const kindLabel =
    kind === 'ipv4' ? t('IPv4 address')
    : kind === 'ipv6' ? t('IPv6 address')
    : kind === 'domain' ? t('Domain')
    : '—'

  return (
    <Card className="animate-pop" style={{ animationDelay: '480ms' }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <span className="flex h-7 w-7 items-center justify-center rounded-2xl rounded-tl-sm bg-odyssey-silver/20 ring-1 ring-inset ring-odyssey-silver/30">
            <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-odyssey-silver" />
          </span>
          {t('Server address type')}
        </CardTitle>
        <CardDescription>{t('Paste a server address — the panel detects the type and auto-wraps IPv6 in [] inside the links.')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1.2.3.4 · 2001:db8::1 · vps.example.com"
          className="h-9 flex-1 font-mono text-xs"
          dir="ltr"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setValue(window.location.hostname)}
        >
          {t('Use current panel address')}
        </Button>
        <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground" dir="auto">
          {t('detected')}: <span className="font-semibold text-foreground">{kindLabel}</span>
        </span>
      </CardContent>
    </Card>
  )
}
