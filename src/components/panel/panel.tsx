'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Users,
  Server,
  Radar,
  Settings as SettingsIcon,
  Shield,
  Menu,
  LogOut,
  Moon,
  Sun,
  Languages,
  Check,
} from 'lucide-react'
import { api } from './api'
import { useLang, type Lang } from '@/lib/i18n'
import { OdysseyEmblem, OdysseyWordmark } from './odyssey-logo'
import { DashboardView } from './views/dashboard'
import { ClientsView } from './views/clients'
import { NodesView } from './views/nodes'
import { ScannerView } from './views/scanner'
import { AntiFilterView } from './views/antifilter'
import { SettingsView } from './views/settings'

export type ViewKey = 'dashboard' | 'clients' | 'antifilter' | 'nodes' | 'scanner' | 'settings'

export const NAV_ITEMS: {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'clients', label: 'Users', icon: Users },
  { key: 'antifilter', label: 'Anti-filter', icon: Shield },
  { key: 'nodes', label: 'Nodes & Workers', icon: Server },
  { key: 'scanner', label: 'Scanner', icon: Radar },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
]

/** True when the viewport is phone-sized (<768px). */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useLang()
  return (
    <div className="flex items-center gap-3">
      <OdysseyEmblem animated className="h-10 w-10 shrink-0 drop-shadow-[0_3px_10px_oklch(0.6_0.09_214/0.35)]" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <OdysseyWordmark size="sm" tagline={false} />
        </div>
        {!compact && (
          <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            {t('Personal proxy control center')}
          </div>
        )}
      </div>
    </div>
  )
}

/** Language switcher (فارسی / English). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang()
  const options: { value: Lang; label: string; native: string }[] = [
    { value: 'fa', label: t('Persian'), native: 'فارسی' },
    { value: 'en', label: t('English'), native: 'English' },
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)} aria-label={t('Language')}>
          <Languages className="h-4 w-4" />
          <span className="text-xs">{lang === 'fa' ? 'فارسی' : 'English'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t('Language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => setLang(o.value)} className="justify-between">
            <span className="flex items-center gap-2">
              <span className="text-sm">{o.native}</span>
            </span>
            {lang === o.value && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeButton() {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

export function Panel({ initialView }: { initialView?: ViewKey }) {
  const [view, setView] = useState<ViewKey>(initialView || 'dashboard')
  const isMobile = useIsMobile()
  const { t, lang } = useLang()

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {}
    window.dispatchEvent(new Event('panel:unauthorized'))
    toast.success(lang === 'fa' ? 'خارج شدی 👋' : 'Signed out')
  }

  const content = (() => {
    switch (view) {
      case 'dashboard':
        return <DashboardView onNavigate={setView} />
      case 'clients':
        return <ClientsView />
      case 'antifilter':
        return <AntiFilterView />
      case 'nodes':
        return <NodesView />
      case 'scanner':
        return <ScannerView />
      case 'settings':
        return <SettingsView />
    }
  })()

  const activeItem = NAV_ITEMS.find((n) => n.key === view)

  // ───────────────────────────── MOBILE ────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Mobile top bar */}
        <header className="glass sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-background/70 px-4 py-3">
          <Logo compact />
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeButton />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label={t('Open menu')}>
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{t('Navigation')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {NAV_ITEMS.map((item) => (
                  <DropdownMenuItem key={item.key} onClick={() => setView(item.key)}>
                    <item.icon className="h-4 w-4" />
                    {t(item.label)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="h-4 w-4" /> {t('Sign out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content with room for the bottom bar */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5">
          {content}
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="glass fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 backdrop-blur-xl"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto grid max-w-md grid-cols-6">
            {NAV_ITEMS.map((item) => {
              const active = view === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className="group flex flex-col items-center gap-1 py-1.5"
                >
                  <span
                    className={cn(
                      'relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                      active
                        ? 'bg-gradient-to-r from-odyssey-cyan/20 to-odyssey-navy/10 text-odyssey-deep shadow-[inset_0_0_0_1px_oklch(0.72_0.1_214/0.35),0_4px_16px_-8px_oklch(0.55_0.09_220/0.5)] dark:text-odyssey-bright'
                        : 'text-muted-foreground/75 group-active:scale-95'
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span
                    className={cn(
                      'text-[10px] leading-none',
                      active ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {t(item.label)}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    )
  }

  // ───────────────────────────── DESKTOP ───────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e bg-sidebar md:flex">
          <div className="px-5 pb-5 pt-6">
            <Logo />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
            <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
              {t('Menu')}
            </div>
            {NAV_ITEMS.map((item) => {
              const active = view === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-odyssey-cyan/20 via-odyssey-navy/10 to-transparent text-foreground shadow-[inset_0_0_0_1px_oklch(0.72_0.1_214/0.32),0_4px_16px_-8px_oklch(0.55_0.09_220/0.5)]'
                      : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <span className="absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-odyssey-cyan to-odyssey-silver shadow-[0_0_10px_oklch(0.72_0.1_214/0.8)]" />
                  )}
                  <item.icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      active ? 'text-odyssey-cyan dark:text-odyssey-bright' : 'text-muted-foreground/80 group-hover:text-foreground'
                    )}
                  />
                  {t(item.label)}
                </button>
              )
            })}
          </nav>

          <div className="space-y-1 border-t p-3">
            <div className="flex items-center gap-1.5 px-1 pb-1">
              <LanguageSwitcher className="flex-1" />
              <ThemeButton />
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {t('Sign out')}
            </button>
            <div className="mt-2 flex items-center gap-2.5 rounded-lg border bg-white/[0.03] px-3 py-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-odyssey-navy to-odyssey-cyan text-[10px] font-bold text-white">
                {t('Admin').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-medium">{t('Admin')}</div>
                <div className="truncate text-[10px] text-muted-foreground">{t('Full access')}</div>
              </div>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-8 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-6xl">{content}</div>
        </main>
      </div>

      <footer className="mt-auto border-t px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground/80">
          <span className="flex items-center gap-2">
            <OdysseyEmblem className="h-4 w-4" />
            <span dir="ltr" className="font-display font-semibold uppercase tracking-[0.25em]">Odyssey</span>
            <span>· {t('Anti-censorship control plane')}</span>
          </span>
          <span className="hidden sm:inline">{t('multi-protocol · anti-filter · self-hosted')}</span>
        </div>
      </footer>
    </div>
  )
}
