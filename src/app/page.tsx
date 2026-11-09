'use client'

import { useEffect, useState } from 'react'
import { Login } from '@/components/panel/login'
import { Panel } from '@/components/panel/panel'
import { useLang } from '@/lib/i18n'

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
    const onUnauthorized = () => setAuthed(false)
    window.addEventListener('panel:unauthorized', onUnauthorized)
    return () => {
      cancelled = true
      window.removeEventListener('panel:unauthorized', onUnauthorized)
    }
  }, [])

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
