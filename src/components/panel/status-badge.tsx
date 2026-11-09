'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useLang } from '@/lib/i18n'

export type BadgeKind = 'active' | 'expired' | 'exhausted' | 'disabled' | 'up' | 'down' | 'unknown' | 'green' | 'red' | 'amber' | 'gray'

const STYLES: Record<BadgeKind, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  up: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  expired: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  down: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  red: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  exhausted: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  disabled: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30',
  unknown: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30',
  gray: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30',
}

const PULSE: Record<BadgeKind, boolean> = {
  active: false,
  up: false,
  green: false,
  expired: false,
  down: true,
  red: true,
  exhausted: true,
  amber: true,
  disabled: false,
  unknown: false,
  gray: false,
}

/** Default translated labels for kind-only usage. */
const KIND_LABEL: Partial<Record<BadgeKind, string>> = {
  active: 'Active',
  up: 'up',
  down: 'down',
  expired: 'Expired',
  exhausted: 'Exhausted',
  disabled: 'disabled',
  unknown: 'unknown',
}

export function StatusBadge({ kind, label }: { kind: BadgeKind; label?: string }) {
  const { t } = useLang()
  const text = label ?? (KIND_LABEL[kind] ? t(KIND_LABEL[kind] as string) : kind)
  return (
    <Badge variant="outline" className={cn('gap-1.5 rounded-full px-2.5 font-semibold', STYLES[kind])}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full bg-current',
          PULSE[kind] && 'animate-pulse shadow-[0_0_6px_currentColor]'
        )}
      />
      {text}
    </Badge>
  )
}
