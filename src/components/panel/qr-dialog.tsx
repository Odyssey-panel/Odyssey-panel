'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton } from './copy'
import { Skeleton } from '@/components/ui/skeleton'
import { useLang } from '@/lib/i18n'

type QrState = { value: string; url: string; error: string } | null

export function QrDialog({
  open,
  onOpenChange,
  value,
  title,
  description,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  value: string
  title?: string
  description?: string
}) {
  const [qr, setQr] = useState<QrState>(null)
  const { t } = useLang()

  useEffect(() => {
    if (!open || !value) return
    let cancelled = false
    QRCode.toDataURL(value, { width: 512, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr({ value, url, error: '' })
      })
      .catch((e) => {
        if (!cancelled) setQr({ value, url: '', error: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [open, value])

  const fresh = qr && qr.value === value ? qr : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title || t('Subscription QR')}</DialogTitle>
          <DialogDescription>
            {description || t('Scan it with v2rayNG, Nekobox, Streisand or any client that supports subscription QR.')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {fresh?.error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
              {fresh.error}
            </div>
          ) : fresh?.url ? (
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 p-2 ring-1 ring-inset ring-white/10">
              <img
                src={fresh.url}
                alt="QR code"
                className="h-auto w-full max-w-[280px] rounded-xl bg-white p-2.5 shadow-[0_8px_30px_-10px_oklch(0_0_0/0.5)]"
              />
            </div>
          ) : (
            <Skeleton className="h-[280px] w-[280px] rounded-xl" />
          )}
          <div className="w-full">
            <CopyButton value={value} label={t('Copy link')} className="w-full" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
