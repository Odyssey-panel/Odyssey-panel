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
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-odyssey-navy to-odyssey-cyan shadow-[0_0_8px_oklch(0.72_0.1_214/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-odyssey-cyan/90">
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
