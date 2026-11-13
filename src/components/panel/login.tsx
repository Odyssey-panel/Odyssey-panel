'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from './api'
import { useLang } from '@/lib/i18n'
import { LanguageSwitcher } from './panel'
import { OdysseyLogoImage } from './odyssey-logo'

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
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useLang()

  const fillDefaultPassword = () => {
    setPassword('admin123')
    setShowPw(true) // reveal what was typed — no guesswork
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
      toast.success(t('Hello, sir 👋'), { description: t('Welcome back to your control panel') })
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Real reason from the server — never a vague "Unauthorized".
        toast.error(t('Wrong password — check it and try again'))
      } else {
        toast.error(err instanceof Error ? err.message : t('Login failed'))
      }
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
        {/* Brand hero — the real logo image the admin supplied */}
        <div className="mb-7 flex flex-col items-center text-center">
          <OdysseyLogoImage className="h-44 w-44 shadow-[0_24px_70px_-20px_oklch(0.5_0.1_220/0.5)]" />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-odyssey-cyan/12 px-3 py-1 text-[11px] font-semibold text-odyssey-deep ring-1 ring-inset ring-odyssey-cyan/30 dark:text-odyssey-bright">
            <span className="h-1.5 w-1.5 rounded-full bg-odyssey-cyan animate-breathe" />
            {t('multi-protocol · anti-filter · self-hosted')}
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  dir="ltr"
                  placeholder="••••••••"
                  className="h-11 pe-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t('Hide password') : t('Show password')}
                  className="absolute inset-y-0 end-2 my-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading || !password}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {loading ? t('Signing in…') : t('Sign in')}
            </Button>
            <button
              type="button"
              onClick={fillDefaultPassword}
              className="group mx-auto flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-odyssey-cyan/40 hover:text-foreground"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{t('Use default password')}:</span>
              <code dir="ltr" className="font-mono font-semibold text-foreground/80 transition-colors group-hover:text-foreground">
                admin123
              </code>
            </button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              {t('If it keeps failing, check the keyboard layout (EN) or Caps Lock — tap the eye to see what you typed.')}
            </p>
          </div>
        </form>

        <p className="mt-5 text-center text-[11px] text-muted-foreground/70">
          {t('Anti-censorship control plane')}
        </p>
      </div>
    </div>
  )
}
