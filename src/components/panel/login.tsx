'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, Loader2, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { api } from './api'
import { useLang } from '@/lib/i18n'
import { LanguageSwitcher } from './panel'

function AuroraOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="animate-float absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-violet-600/25 blur-[110px] dark:bg-violet-600/30" />
      <div className="animate-float-slow absolute top-1/3 -right-28 h-[24rem] w-[24rem] rounded-full bg-cyan-500/20 blur-[110px] dark:bg-cyan-500/25" />
      <div className="animate-float absolute -bottom-32 left-1/3 h-[22rem] w-[22rem] rounded-full bg-indigo-500/20 blur-[110px] dark:bg-indigo-600/25" />
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
      <AuroraOrbs />

      {/* Language switcher */}
      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>

      <div className="animate-rise w-full max-w-sm">
        {/* Brand row */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-[0_8px_40px_-8px_oklch(0.55_0.24_292/0.8)] ring-1 ring-inset ring-white/25">
            <Shield className="h-8 w-8 text-white" strokeWidth={2.2} />
            <span className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/30 to-transparent opacity-70" />
          </div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight">
            {t('Odyssey Panel')}
          </h1>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-[11px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t('Free forever')} · {t('self-hosted proxy & subscription panel')}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('Sign in to manage users, nodes and subscription links')}
          </p>
        </div>

        {/* Glass card */}
        <form onSubmit={submit} className="glass rounded-2xl border bg-card p-6 shadow-[0_20px_70px_-20px_oklch(0.45_0.2_292/0.55)] dark:shadow-[0_24px_80px_-24px_oklch(0_0_0/0.85)]">
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
