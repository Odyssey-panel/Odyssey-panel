'use client'

import { cn } from '@/lib/utils'

/** Premium page header: eyebrow kicker + display title + subtitle, with actions on the right. */
export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('animate-rise flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {kicker && (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_8px_oklch(0.62_0.22_293/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300/90">
              {kicker}
            </span>
          </div>
        )}
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
