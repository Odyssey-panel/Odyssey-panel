'use client'

import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLang } from '@/lib/i18n'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  // fallback for non-secure contexts / older mobile browsers
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function CopyButton({
  value,
  label,
  className,
  size = 'sm',
}: {
  value: string
  label?: string
  className?: string
  size?: 'sm' | 'icon'
}) {
  const [copied, setCopied] = useState(false)
  const { t } = useLang()
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn('h-8 gap-1.5', className)}
      aria-label={label ? `${t('Copy')} ${label}` : t('Copy')}
      onClick={async () => {
        const ok = await copyText(value)
        if (ok) {
          setCopied(true)
          toast.success(label ? t('Copied {label}', { label }) : t('Copied'))
          setTimeout(() => setCopied(false), 1500)
        } else {
          toast.error(t('Copy failed — long-press to copy manually'))
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {label ? <span className="text-xs">{copied ? t('Copied') : label}</span> : null}
    </Button>
  )
}

/** A value box with tap-to-copy — mobile friendly. */
export function CopyField({
  label,
  value,
  mono = true,
  secret = false,
}: {
  label: string
  value: string
  mono?: boolean
  secret?: boolean
}) {
  const [revealed, setRevealed] = useState(!secret)
  const { t } = useLang()
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          {secret && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? t('Hide') : t('Show')}
            </button>
          )}
          <CopyButton value={value} size="icon" className="h-7 w-7" />
        </div>
      </div>
      <div
        className={cn(
          'min-h-9 cursor-pointer rounded-md border bg-muted/40 px-3 py-2 break-all',
          mono && 'font-mono text-xs',
          !revealed && 'select-none blur-sm'
        )}
        onClick={async () => {
          const ok = await copyText(value)
          if (ok) toast.success(t('Copied {label}', { label }))
        }}
        title={t('Tap to copy')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') void navigator.clipboard?.writeText(value)
        }}
      >
        {value || '—'}
      </div>
    </div>
  )
}
