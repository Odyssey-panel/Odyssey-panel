'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { api } from './api'
import { useLang } from '@/lib/i18n'
import { LanguageSwitcher } from './panel'
import { OdysseyEmblem, OdysseyWordmark } from './odyssey-logo'

function SeaOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="animate-float absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-odyssey-navy/25 blur-[110px] dark:bg-odyssey-cyan/14" />
      <div className="animate-float-slow absolute top-1/3 -right-28 h-[24rem] w-[24rem] rounded-full bg-odyssey-cyan/25 blur-[110px] dark:bg-odyssey-cyan/16" />
      <div className="animate-float absolute -bottom-32 left-1/3 h-[22rem] w-[22rem] rounded-full bg-sky-600/20 blur-[110px] dark:bg-odyssey-deep/60" />
    </div>
  )
}

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { t, lang } = useLang()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
      toast.success(t('Hello, sir 👋'), { description: t('Welcome back to your control panel') })
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <SeaOrbs />

      {/* Language switcher */}
      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>

      <div className="animate-rise w-full max-w-sm">
        {/* Brand hero — the Odyssey emblem over the wordmark */}
        <div className="mb-7 flex flex-col items-center text-center">
          <OdysseyEmblem animated className="h-24 w-24 drop-shadow-[0_10px_36px_oklch(0.6_0.09_214/0.4)]" />
          <OdysseyWordmark size="lg" tagline={false} className="mt-4" />
          {lang === 'fa' && (
            <div className="mt-1.5 text-sm font-medium text-odyssey-deep/70 dark:text-odyssey-silver/80">
              اودیسه
            </div>
          )}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-odyssey-cyan/12 px-3 py-1 text-[11px] font-semibold text-odyssey-deep ring-1 ring-inset ring-odyssey-cyan/30 dark:text-odyssey-bright">
            <span className="h-1.5 w-1.5 rounded-full bg-odyssey-cyan" />
            {t('Free forever')} · {t('self-hosted proxy & subscription panel')}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('Sign in to manage users, nodes and subscription links')}
          </p>
        </div>

        {/* Glass card */}
        <form onSubmit={submit} className="glass rounded-2xl border bg-card p-6 shadow-[0_20px_70px_-20px_oklch(0.35_0.06_248/0.5)] dark:shadow-[0_24px_80px_-24px_oklch(0_0_0/0.85)]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">{t('Admin password')}</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                placeholder="••••••••"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading || !password}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {loading ? t('Signing in…') : t('Sign in')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t('Default password is')} <span className="font-mono">admin123</span> {t('— change it in Settings.')}
            </p>
          </div>
        </form>

        <p className="mt-5 text-center text-[11px] text-muted-foreground/70">
          {t('Free · self-hosted · works on any domain')}
        </p>
      </div>
    </div>
  )
}
