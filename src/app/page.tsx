'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Login } from '@/components/panel/login'
import { Panel } from '@/components/panel/panel'
import { useLang } from '@/lib/i18n'

/** Throttle so five parallel 401s don't spam five identical toasts. */
let lastSessionToastAt = 0

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const { t } = useLang()

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = (await res.json()) as { ok: boolean }
        if (!cancelled) setAuthed(data.ok)
      } catch {
        if (!cancelled) setAuthed(false)
      }
    }
    void check()
    // Session died mid-use (expiry, new panel secret, …): return to the login
    // screen and tell the admin why, instead of leaving "Unauthorized" errors.
    const onUnauthorized = () => {
      setAuthed(false)
      const now = Date.now()
      if (now - lastSessionToastAt > 5000) {
        lastSessionToastAt = now
        toast.warning(t('Session expired — please sign in again'))
      }
    }
    // Deliberate sign-out: just switch to the login screen (a toast is already
    // shown by the logout button itself).
    const onSignedOut = () => setAuthed(false)
    window.addEventListener('panel:unauthorized', onUnauthorized)
    window.addEventListener('panel:signedout', onSignedOut)
    return () => {
      cancelled = true
      window.removeEventListener('panel:unauthorized', onUnauthorized)
      window.removeEventListener('panel:signedout', onSignedOut)
    }
  }, [t])

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('Loading panel…')}</p>
        </div>
      </div>
    )
  }

  return authed ? <Panel /> : <Login onSuccess={() => setAuthed(true)} />
}
