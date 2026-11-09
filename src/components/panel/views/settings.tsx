'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyField } from '../copy'
import { api, useApi } from '../api'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useLang, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Loader2, Save, Globe2, Languages, Palette, MonitorSmartphone, Sun, Moon } from 'lucide-react'

type Settings = {
  publicUrl: string
  lastOrigin: string
}

export function SettingsView() {
  const { data, loading, reload } = useApi<{ settings: Settings }>('/api/admin/settings')
  const [form, setForm] = useState<Settings | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const { lang, setLang, t } = useLang()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    if (data?.settings && !form) setForm({ ...data.settings })
  }, [data, form])

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const body: Record<string, string> = { ...form }
      if (newPassword) body.newPassword = newPassword
      const res = await api<{ settings: Settings }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) })
      setForm({ ...res.settings })
      setNewPassword('')
      toast.success(t('Settings saved'))
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading && !form) {
    return <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-64" />)}</div>
  }
  if (!form) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const effectiveUrl = form.publicUrl || form.lastOrigin || origin

  const langOptions: { value: Lang; native: string; sub: string }[] = [
    { value: 'fa', native: 'فارسی', sub: t('Persian (RTL)') },
    { value: 'en', native: 'English', sub: t('English (LTR)') },
  ]

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_8px_oklch(0.62_0.22_293/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300/90">
              {t('Configuration')}
            </span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">{t('Settings')}</h1>
          <p className="text-sm text-muted-foreground">{t('Panel URL, admin password and appearance')}</p>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('Save changes')}
        </Button>
      </div>

      {/* Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4 text-primary" /> {t('Panel')}
          </CardTitle>
          <CardDescription>{t('Public URL and admin credentials')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField label={t('Effective panel URL (auto-detected or pinned)')} value={effectiveUrl || t('not detected yet')} mono={false} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-publicurl">{t('Public URL override')}</Label>
              <Input
                id="st-publicurl"
                placeholder={t('https://panel.example.com (leave empty to auto-detect)')}
                value={form.publicUrl}
                onChange={(e) => setForm((f) => (f ? { ...f, publicUrl: e.target.value } : f))}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('Used in subscription links and QR codes. Empty = auto-detected from the browser you manage the panel with, so it adapts to whatever domain you deploy on.')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-password">{t('Change admin password')}</Label>
              <Input
                id="st-password"
                type="password"
                placeholder={t('new password (min 6 chars)')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language & appearance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Languages className="h-4 w-4 text-primary" /> {t('Language & appearance')}
          </CardTitle>
          <CardDescription>{t('Switch anytime — the whole panel translates and mirrors instantly.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Language */}
          <div className="grid gap-2 sm:grid-cols-2">
            {langOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setLang(o.value)}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-4 text-start transition-all duration-200 hover:bg-white/[0.05]',
                  lang === o.value && 'border-primary/50 bg-primary/5 ring-1 ring-inset ring-primary/30'
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{o.native}</span>
                  <span className="block text-xs text-muted-foreground">{o.sub}</span>
                </span>
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full border',
                    lang === o.value ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                  )}
                >
                  {lang === o.value && <span className="h-2 w-2 rounded-full bg-current" />}
                </span>
              </button>
            ))}
          </div>

          {/* Theme */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> {t('Theme')}
            </Label>
            <div className="inline-flex rounded-lg border p-1">
              {[
                { value: 'dark', label: t('Dark'), icon: Moon },
                { value: 'light', label: t('Light'), icon: Sun },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setTheme(o.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                    theme === o.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <o.icon className="h-3.5 w-3.5" /> {o.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layouts info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4 text-primary" /> {t('Layout')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('This panel ships with two layouts — desktop with a sidebar, and mobile with bottom navigation. It picks the right one automatically based on your screen.')}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold">{t('Desktop layout')}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t('sidebar + full tables')}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold">{t('Mobile layout')}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t('bottom navigation + compact cards')}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
