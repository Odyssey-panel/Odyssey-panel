'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '../status-badge'
import { CopyButton, CopyField } from '../copy'
import { QrDialog } from '../qr-dialog'
import { api, useApi } from '../api'
import { bytesToGb, daysLeft, formatBytes, formatDate, trafficState } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { toast } from 'sonner'
import { buildShareLink, buildDeepLinks, buildTelegramTapLink, addressKind } from '@/lib/links'
import { runDeviceTest, type TunnelTestResult } from '@/lib/selftest'
import { ISP_PRESETS, ispFragment } from '@/lib/isps'
import {
  Plus,
  Search,
  QrCode,
  Link2,
  Trash2,
  Pencil,
  RotateCcw,
  CalendarPlus,
  Download,
  RefreshCw,
  Zap,
  Loader2,
  Server,
  Send,
  Smartphone,
  Cloud,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { WORKER_STEPS_FA } from '@/lib/worker-kit'

type ProxyRow = {
  id: string
  protocol: string
  remark: string
  address: string
  port: number
  secret: string
  sni: string | null
  host: string | null
  path: string | null
  transport: string
  tls: boolean
  fragment: string | null
  serverConfig: string | null
}

type ClientRow = {
  id: string
  name: string
  note: string | null
  limitBytes: number
  usedBytes: number
  expiresAt: string | null
  status: string
  subToken: string
  createdAt: string
  proxies: ProxyRow[]
}

const PROTOCOLS = ['vless', 'vmess', 'trojan', 'shadowsocks', 'hysteria2', 'tuic', 'mtproto'] as const
const TRANSPORTS = ['ws', 'grpc', 'tcp'] as const

function isValidServerHost(value: string): boolean {
  const host = value.trim().replace(/^\\[|\\]$/g, '')
  if (!host) return false
  if (/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(host)) return host.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255)
  if (host.includes(':')) {
    try { new URL(`http://[${host}]/`); return true } catch { return false }
  }
  return host.length <= 253 && /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(host)
}
/** Protocols with xray-style stream fields (transport/path/host/TLS switch). */
const STREAM_PROTOS = new Set(['vless', 'vmess', 'trojan', 'shadowsocks'])
/** Fragment only applies to URL-style TLS links (vless/trojan). */
const FRAGMENT_PROTOS = new Set(['vless', 'trojan'])

// ────────────────────────────────────────────────────────────────────────────
// Backend source — where the account actually terminates.
//  builtin → the panel's own xray backend (works out of the box)
//  worker  → a Cloudflare Worker registered in Nodes & workers
//  own     → the admin's own VPS/server (manual fields)
// ────────────────────────────────────────────────────────────────────────────

type BackendMode = 'builtin' | 'worker' | 'own'

type WorkerRow = {
  id: string
  name: string
  url: string
  status: string
  note: string | null
}

function panelOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url.replace(/^https?:\/\//i, '').split('/')[0]
  }
}

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname && u.pathname !== '/' ? u.pathname : '/'
  } catch {
    return '/'
  }
}

/** Submit fields for the chosen backend source. */
function backendSubmitFields(
  mode: BackendMode,
  worker: WorkerRow | null,
  manual: { address: string; port: string; sni: string; host: string; path: string; transport: string; tls: boolean },
) {
  if (mode === 'builtin') {
    const origin = panelOrigin()
    const h = hostFromUrl(origin)
    return {
      address: origin,
      port: 443,
      sni: h,
      host: h,
      path: '/vlessws',
      transport: 'ws',
      tls: true,
    }
  }
  if (mode === 'worker' && worker) {
    const h = hostFromUrl(worker.url)
    return {
      address: h,
      port: 443,
      sni: h,
      host: h,
      path: pathFromUrl(worker.url),
      transport: 'ws',
      tls: true,
    }
  }
  return {
    address: manual.address.trim(),
    port: Number(manual.port) || 443,
    sni: manual.sni.trim() || undefined,
    host: manual.host.trim() || undefined,
    path: manual.path.trim() || '/',
    transport: manual.transport,
    tls: manual.tls,
  }
}

/** URL-paste repair on blur — "https://host:8443/ws" fills the fields. */
function repairPastedAddress(value: string): { address: string; port?: string; path?: string; tls?: boolean; sni?: string } | null {
  const v = value.trim()
  if (!/^https?:\/\//i.test(v)) return null
  try {
    const u = new URL(v)
    return {
      address: u.hostname,
      port: u.port || undefined,
      path: u.pathname !== '/' ? u.pathname : undefined,
      tls: u.protocol === 'https:' ? true : false,
      sni: u.hostname,
    }
  } catch {
    return null
  }
}

function BackendPicker({
  mode,
  onModeChange,
  workers,
  workerId,
  onWorkerIdChange,
}: {
  mode: BackendMode
  onModeChange: (m: BackendMode) => void
  workers: WorkerRow[] | undefined
  workerId: string
  onWorkerIdChange: (id: string) => void
}) {
  const { t } = useLang()
  const options: { id: BackendMode; label: string; icon: typeof Server; desc: string }[] = [
    { id: 'builtin', label: t('Odyssey built-in'), icon: ShieldCheck, desc: t('Ready in 0 seconds — runs on this panel') },
    { id: 'worker', label: t('Cloudflare worker'), icon: Cloud, desc: t('Iran-optimized via your worker') },
    { id: 'own', label: t('My own server'), icon: Server, desc: t('VPS / custom host') },
  ]
  const workerList = workers || []
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => {
          const active = mode === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onModeChange(o.id)}
              className={cnPicker(active)}
              title={o.desc}
            >
              <o.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[11px] font-medium leading-tight">{o.label}</span>
            </button>
          )
        })}
      </div>
      {mode === 'builtin' && (
        <p className="rounded-lg border border-dashed p-2.5 text-xs leading-relaxed text-muted-foreground">
          {t('The config will run on this panel itself (wss) — nothing else to set up. The address fields below are filled automatically.')}
        </p>
      )}
      {mode === 'worker' && (
        <div className="space-y-1.5">
          {workerList.length === 0 ? (
            <p className="rounded-lg border border-dashed p-2.5 text-xs leading-relaxed text-muted-foreground">
              {t('No worker registered yet — add one in Nodes & workers (the worker code and step-by-step guide are there).')}
            </p>
          ) : (
            <Select value={workerId} onValueChange={onWorkerIdChange}>
              <SelectTrigger aria-label={t('Worker')}><SelectValue placeholder={t('Pick a worker')} /></SelectTrigger>
              <SelectContent>
                {workerList.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} · {hostFromUrl(w.url)}
                  </SelectItem>
                ))
                }
              </SelectContent>
            </Select>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {WORKER_STEPS_FA[3]}
          </p>
        </div>
      )}
    </div>
  )
}

function cnPicker(active: boolean): string {
  return [
    'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 transition-colors',
    active
      ? 'border-cyan-400/40 bg-cyan-400/10 text-foreground'
      : 'border-border/60 text-muted-foreground hover:bg-white/[0.04]',
  ].join(' ')
}

function originBase(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export function ClientsView() {
  const { data, loading, reload } = useApi<{ clients: ClientRow[] }>('/api/admin/clients')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<ClientRow | null>(null)
  const [edit, setEdit] = useState<ClientRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)
  const [qr, setQr] = useState<{ open: boolean; value: string; name: string }>({ open: false, value: '', name: '' })
  const { t, lang } = useLang()

  const clients = useMemo(() => {
    const list = data?.clients ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((c) => c.name.toLowerCase().includes(q) || (c.note || '').toLowerCase().includes(q))
  }, [data, search])

  const act = async (fn: () => Promise<unknown>, successMsg?: string) => {
    try {
      await fn()
      if (successMsg) toast.success(successMsg)
      await reload()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Request failed'))
      return false
    }
  }

  const subUrl = (c: ClientRow) => `${originBase()}/api/sub/${c.subToken}`

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-odyssey-navy to-odyssey-cyan shadow-[0_0_8px_oklch(0.72_0.1_214/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-odyssey-cyan/90">
              {t('Subscribers')}
            </span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">{t('Users')}</h1>
          <p className="text-sm text-muted-foreground">{t('Subscribers, traffic limits, expiry and subscription links')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="h-4 w-4" /> <span className="sr-only sm:inline">{t('Refresh')}</span>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t('New user')}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('Search by name or note…')}
          className="ps-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('Search users')}
        />
      </div>

      {loading && !data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('No users yet. Create your first user to generate proxy accounts and a subscription link.')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => {
            const state = trafficState(c.usedBytes, c.limitBytes, c.status, c.expiresAt, lang)
            const pct = c.limitBytes > 0 ? Math.min(100, (c.usedBytes / c.limitBytes) * 100) : 0
            const dl = daysLeft(c.expiresAt)
            const links = c.proxies.map((p) => buildShareLink(p)).filter(Boolean)
            return (
              <Card key={c.id} className="transition-colors hover:border-primary/30">
                <CardContent className="p-4 sm:p-5">
                  {/* Header — avatar + name + badges ONLY. No buttons beside the
                      name, so nothing can ever overlap it (mobile RTL bug). */}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl rounded-tr-sm bg-gradient-to-br from-odyssey-navy to-odyssey-cyan text-sm font-bold text-white">
                      {c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        className="truncate text-base font-semibold hover:underline"
                        onClick={() => setDetail(c)}
                        aria-label={t('Open details for {name}', { name: c.name })}
                      >
                        {c.name}
                      </button>
                      <StatusBadge kind={state.kind} label={state.label} />
                      {c.proxies.length > 0 && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.proxies.length} {t('accounts')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Meta line — aligned under the name */}
                  <div className="mt-2 ps-[52px] text-xs leading-relaxed text-muted-foreground">
                    <span dir="ltr" className="inline-block">
                      {c.limitBytes > 0
                        ? `${formatBytes(c.usedBytes)} / ${formatBytes(c.limitBytes)}`
                        : formatBytes(c.usedBytes)}
                    </span>
                    {c.limitBytes > 0 ? '' : ` ${t('used · unlimited')}`}
                    {' · '}
                    {c.expiresAt
                      ? dl !== null && dl > 0
                        ? t('expires in {d} days ({date})', { d: dl, date: formatDate(c.expiresAt, lang) })
                        : t('expired {date}', { date: formatDate(c.expiresAt, lang) })
                      : t('no expiry')}
                    {c.note ? ` · ${c.note}` : ''}
                  </div>
                  {c.limitBytes > 0 && (
                    <div className="mt-2 max-w-md ps-[52px]">
                      <Progress value={pct} aria-label="Traffic used" />
                    </div>
                  )}

                  {/* Actions — a dedicated grid row: cells can never collide,
                      thumb-sized on mobile (2×2), single row on desktop. */}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm sm:grid-cols-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 justify-center px-2"
                      onClick={() => setQr({ open: true, value: subUrl(c), name: c.name })}
                    >
                      <QrCode className="h-3.5 w-3.5" /> <span className="text-xs">{t('QR')}</span>
                    </Button>
                    <CopyButton value={subUrl(c)} label={t('Sub link')} className="h-9 justify-center" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 justify-center px-2"
                      onClick={() => setDetail(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> <span className="text-xs">{t('Manage')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 justify-center px-2 text-destructive"
                      onClick={() => setDeleteTarget(c)}
                      aria-label={t('Delete {name}', { name: c.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Config address — full text right on the card */}
                  <ConfigAddressBlock
                    links={links}
                    onQr={(value) => setQr({ open: true, value, name: c.name })}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={async () => {
          setCreateOpen(false)
          await reload()
        }}
      />

      {detail && (
        <DetailDialog
          client={detail}
          onOpenChange={(v) => {
            if (!v) setDetail(null)
            else void reload().then(() => setDetail((d) => (d ? { ...d } : d)))
          }}
          onChanged={async () => {
            await reload()
            const fresh = await api<{ client: ClientRow }>(`/api/admin/clients/${detail.id}`)
            setDetail(fresh.client)
          }}
          onQr={(value) => setQr({ open: true, value, name: detail.name })}
        />
      )}

      {edit && (
        <EditClientDialog
          client={edit}
          onOpenChange={(v) => !v && setEdit(null)}
          onDone={async () => {
            setEdit(null)
            await reload()
          }}
        />
      )}

      <QrDialog
        open={qr.open}
        onOpenChange={(v) => setQr((s) => ({ ...s, open: v }))}
        value={qr.value}
        title={t('QR — {name}', { name: qr.name })}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete user “{name}”?', { name: deleteTarget?.name || '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This permanently removes the user, all proxy accounts and revokes the subscription link.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) await act(() => api(`/api/admin/clients/${deleteTarget.id}`, { method: 'DELETE' }), t('User deleted'))
                setDeleteTarget(null)
              }}
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

function CreateClientDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [trafficGb, setTrafficGb] = useState('10')
  const [days, setDays] = useState('30')
  const [note, setNote] = useState('')
  const [withAccount, setWithAccount] = useState(true)
  const [protocol, setProtocol] = useState<string>('vless')
  const [fragmentOn, setFragmentOn] = useState(true)
  const [fragment, setFragment] = useState('100-200,20-30,tlshello')
  const [selectedFragmentPreset, setSelectedFragmentPreset] = useState<string | null>(null)
  const [backendMode, setBackendMode] = useState<BackendMode>('builtin')
  const [workerId, setWorkerId] = useState('')
  const { data: workersData } = useApi<{ workers: WorkerRow[] }>(open ? '/api/admin/workers' : null)
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('443')
  const [sni, setSni] = useState('')
  const [transport, setTransport] = useState<string>('ws')
  const [path, setPath] = useState('/')
  const [host, setHost] = useState('')
  const [tls, setTls] = useState(true)
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const isMtprotoC = protocol === 'mtproto'
  const isSingboxC = protocol === 'hysteria2' || protocol === 'tuic'
  const showStreamC = STREAM_PROTOS.has(protocol)
  const showFragmentC = FRAGMENT_PROTOS.has(protocol)
  const usePicker = showStreamC
  const workers = workersData?.workers
  const pickedWorker = workers?.find((w) => w.id === workerId) || null

  const submit = async () => {
    if (!name.trim()) {
      toast.error(t('Name is required'))
      return
    }
    // A user is valid with just a name. With the built-in backend the account
    // needs zero extra input; for other sources an address must be present.
    const fields = backendSubmitFields(backendMode, pickedWorker, { address, port, sni, host, path, transport, tls })
    const withProxy = withAccount && (usePicker ? backendMode === 'builtin' || Boolean(fields.address) : Boolean(fields.address))
    if (withAccount && (backendMode === 'own' || !usePicker) && !isValidServerHost(fields.address)) {
      toast.error(t('Enter a valid IPv4, IPv6 or domain address'))
      return
    }
    if (withAccount && (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
      toast.error(t('Enter a valid port between 1 and 65535'))
      return
    }
    const skippedProxy = withAccount && !withProxy
    if (withProxy && usePicker && backendMode === 'worker' && !pickedWorker) {
      toast.error(t('Pick a worker first (or register one in Nodes & workers)'))
      return
    }
    setBusy(true)
    try {
      await api('/api/admin/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          trafficGb: Number(trafficGb) || 0,
          days: Number(days) || 0,
          note: note.trim() || undefined,
          protocol: withProxy ? protocol : undefined,
          address: withProxy ? fields.address : undefined,
          port: withProxy ? fields.port : undefined,
          sni: withProxy ? fields.sni : undefined,
          transport: withProxy && !isMtprotoC && !isSingboxC ? fields.transport : undefined,
          path: withProxy && !isMtprotoC && !isSingboxC ? fields.path : undefined,
          host: withProxy && !isMtprotoC && !isSingboxC ? fields.host : undefined,
          tls: withProxy && !isMtprotoC && !isSingboxC ? fields.tls : true,
          // Fragment goes ONLY onto this one config, right at creation.
          fragment: withProxy && showFragmentC && fragmentOn ? fragment.trim() || undefined : undefined,
        }),
      })
      toast.success(
        skippedProxy
          ? t('User created — no server address given, so no proxy account was generated')
          : t('User created — subscription link ready')
      )
      setName(''); setNote(''); setAddress(''); setSni(''); setPort('443'); setPath('/')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Create failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-odyssey-navy to-odyssey-cyan text-white">
              <Plus className="h-4 w-4" />
            </span>
            {t('New config')}
          </DialogTitle>
          <DialogDescription>
            {t('A subscriber with a unique subscription link — plus a ready-to-use config if you want one.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── 1 · User ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-odyssey-navy/10 text-[10px] font-bold text-odyssey-deep dark:bg-odyssey-cyan/15 dark:text-odyssey-bright">1</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('User info')}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">{t('Name *')}</Label>
                <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="alice" autoComplete="off" />
                {name.trim() && (
                  <p className="text-[11px] text-muted-foreground">
                    {t('Config will be named')} <span dir="ltr" className="font-mono font-medium text-foreground/80">Odyssey-{name.trim()}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-traffic">{t('Traffic limit (GB, 0 = unlimited)')}</Label>
                <Input id="c-traffic" type="number" min="0" value={trafficGb} onChange={(e) => setTrafficGb(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-days">{t('Valid for (days, 0 = never)')}</Label>
                <Input id="c-days" type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-note">{t('Note')}</Label>
                <Input id="c-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('friend, family, …')} />
              </div>
            </div>
          </section>

          {/* ── 2 · Config ── */}
          <section className="space-y-3 rounded-xl border bg-muted/20 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-odyssey-navy/10 text-[10px] font-bold text-odyssey-deep dark:bg-odyssey-cyan/15 dark:text-odyssey-bright">2</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Config')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <span>{t('Generate config now')}</span>
                <Switch dir="ltr" checked={withAccount} onCheckedChange={setWithAccount} aria-label={t('Generate config now')} />
              </div>
            </div>

            {withAccount && (
              <div className="space-y-3.5">
                {/* ── Fragment — the requested one-tap anti-filter button, at the
                       top of creation, applied to THIS config only ── */}
                {showFragmentC && (
                  <div
                    className={`rounded-xl border p-3 transition-colors ${
                      fragmentOn
                        ? 'border-odyssey-cyan/40 bg-odyssey-cyan/[0.07] shadow-[inset_0_0_0_1px_oklch(0.72_0.1_214/0.12)]'
                        : 'border-border/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-odyssey-cyan/15 ring-1 ring-inset ring-odyssey-cyan/30">
                          <Zap className="h-4 w-4 text-odyssey-deep dark:text-odyssey-bright" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-tight">{t('Fragment (anti-filter)')}</div>
                          <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                            {fragmentOn ? t('ON — this config only') : t('OFF — plain TLS handshake')}
                          </div>
                        </div>
                      </div>
                      <Switch checked={fragmentOn} onCheckedChange={setFragmentOn} aria-label={t('Fragment (anti-filter)')} />
                    </div>
                    {fragmentOn && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {ISP_PRESETS.map((isp) => (
                            <button
                              key={isp.id}
                              type="button"
                              title={isp.note}
                              onClick={() => {
                                setFragment(ispFragment(isp))
                                setSelectedFragmentPreset(isp.id)
                              }}
                              aria-pressed={selectedFragmentPreset === isp.id}
                              className={selectedFragmentPreset === isp.id ? "rounded-full border border-sky-400 bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-sky-500/25" : "rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-sky-400/60 hover:bg-sky-400/10 hover:text-foreground"}
                            >
                              {isp.name}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={fragment}
                          onChange={(e) => {
                            setFragment(e.target.value)
                            setSelectedFragmentPreset(null)
                          }}
                          placeholder="100-200,20-30,tlshello"
                          dir="ltr"
                          className="font-mono text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Protocol — quick chips instead of a dropdown */}
                <div className="space-y-1.5">
                  <Label>{t('Protocol')}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROTOCOLS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProtocol(p)}
                        className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium uppercase transition-colors ${
                          protocol === p
                            ? 'border-cyan-400/40 bg-cyan-400/10 text-foreground'
                            : 'border-border/60 text-muted-foreground hover:bg-white/[0.04]'
                        }`}
                        aria-pressed={protocol === p}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  {protocol !== 'vless' && (
                    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                      {t('Heads-up: the built-in backend runs vless only. Other protocols need your own server at the address below — otherwise that config will not connect.')}
                    </p>
                  )}
                </div>

                {/* Where the config runs — always visible so the mode can be
                    switched back and forth (was locked once "own" was chosen) */}
                {usePicker && (
                  <div className="space-y-1.5">
                    <Label>{t('Where the config runs')}</Label>
                    <BackendPicker
                      mode={backendMode}
                      onModeChange={setBackendMode}
                      workers={workers}
                      workerId={workerId}
                      onWorkerIdChange={setWorkerId}
                    />
                  </div>
                )}

                {/* Manual server fields — only when the admin brings a server */}
                {(!usePicker || backendMode === 'own') && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>{t('Server address / IP *')}</Label>
                        <Input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          onBlur={() => {
                            const r = repairPastedAddress(address)
                            if (r) {
                              setAddress(r.address)
                              if (r.port) setPort(r.port)
                              if (r.path) setPath(r.path)
                              if (r.tls !== undefined) setTls(r.tls)
                              if (r.sni && !sni.trim()) setSni(r.sni)
                              toast.success(t('Pasted URL detected — fields were filled automatically'))
                            }
                          }}
                          placeholder="203.0.113.10 · 2001:db8::1 · vpn.example.com"
                          dir="ltr"
                          inputMode="url"
                        />
                        <p className="text-[10px] text-muted-foreground" dir="rtl">{t("Supported: IPv4, IPv6 and domain names")} · {addressKind(address) === "ipv4" ? "IPv4" : addressKind(address) === "ipv6" ? "IPv6" : addressKind(address) === "domain" ? t("Domain") : t("Waiting for address")}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('Port *')}</Label>
                        <Input type="number" min="1" max="65535" value={port} onChange={(e) => setPort(e.target.value)} dir="ltr" />
                        <div className="flex flex-wrap gap-1">
                          {[443, 8443, 2053, 2083, 2087, 2096, 80, 8080, 8880, 9443].map((p) => (
                            <button key={p} type="button" onClick={() => setPort(String(p))}
                              aria-pressed={port === String(p)}
                              className={port === String(p)
                                ? 'rounded-md border border-sky-400 bg-sky-500 px-2 py-1 text-[10px] font-semibold text-white'
                                : 'rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-sky-400/60 hover:text-foreground'}>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>{isMtprotoC ? 'FakeTLS domain' : t('SNI / domain')}</Label>
                        <Input value={sni} onChange={(e) => setSni(e.target.value)} placeholder={t('same as address')} />
                      </div>
                      {showStreamC && (
                        <>
                          <div className="space-y-1.5">
                            <Label>{t('Transport')}</Label>
                            <Select value={transport} onValueChange={setTransport}>
                              <SelectTrigger aria-label={t('Transport')}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {TRANSPORTS.map((tr) => <SelectItem key={tr} value={tr}>{tr}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded-lg border px-3">
                            <Label htmlFor="c-tls" className="text-xs">TLS</Label>
                            <Switch id="c-tls" checked={tls} onCheckedChange={setTls} />
                          </div>
                        </>
                      )}
                    </div>
                    {showStreamC && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>{transport === 'grpc' ? t('Service name') : t('WS path')}</Label>
                          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{t('Host header')}</Label>
                          <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder={t('optional')} />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="rounded-xl border bg-background/45 p-3 space-y-2">
                  <div className="text-xs font-semibold">{t('IP and domain providers')}</div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {t('Use an address assigned to your own VPS. IPv4, IPv6 and domain names are accepted. A domain must have an A record for IPv4 or AAAA record for IPv6 pointing to the same server.')}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <a href="https://www.hetzner.com/cloud/" target="_blank" rel="noreferrer" className="rounded-lg border p-2.5 hover:border-sky-400/60">
                      <div className="text-xs font-semibold">Hetzner Cloud</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">IPv4 / IPv6 · static primary IP options</div>
                    </a>
                    <a href="https://www.digitalocean.com/products/droplets" target="_blank" rel="noreferrer" className="rounded-lg border p-2.5 hover:border-sky-400/60">
                      <div className="text-xs font-semibold">DigitalOcean</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">IPv4 / IPv6 · reserved IP options</div>
                    </a>
                    <a href="https://www.vultr.com/products/cloud-compute/" target="_blank" rel="noreferrer" className="rounded-lg border p-2.5 hover:border-sky-400/60">
                      <div className="text-xs font-semibold">Vultr</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">Public IPv4 · IPv6 support · firewall</div>
                    </a>
                    <a href="https://www.ovhcloud.com/en/vps/" target="_blank" rel="noreferrer" className="rounded-lg border p-2.5 hover:border-sky-400/60">
                      <div className="text-xs font-semibold">OVHcloud VPS</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">IPv4 + IPv6 included on VPS plans</div>
                    </a>
                    <a href="https://www.cloudflare.com/products/registrar/" target="_blank" rel="noreferrer" className="rounded-lg border p-2.5 hover:border-sky-400/60 sm:col-span-2">
                      <div className="text-xs font-semibold">Cloudflare DNS</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">Manage your own domain's A / AAAA records</div>
                    </a>
                  </div>
                  <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
                    {t('Provider links are purchase and documentation options, not free IP pools. No provider can guarantee that every IP works on every Iranian ISP. Open the selected TCP/UDP port in both the VPS firewall and provider firewall.')}
                  </p>
                </div>
                {isMtprotoC && (
                  <p className="rounded-lg border border-dashed p-2.5 text-xs leading-relaxed text-muted-foreground">{t('MTProto: address = server IP, port = proxy port — the secret is generated automatically. Users open the link in Telegram.')}</p>
                )}
                {isSingboxC && (
                  <p className="rounded-lg border border-dashed p-2.5 text-xs leading-relaxed text-muted-foreground">{t('Hysteria2/TUIC need a sing-box based server (Hiddify, s-ui, …); the config file has both client and server JSON.')}</p>
                )}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('Create user')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Edit dialog
// ---------------------------------------------------------------------------

function EditClientDialog({ client, onOpenChange, onDone }: { client: ClientRow; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [name, setName] = useState(client.name)
  const [trafficGb, setTrafficGb] = useState(String(bytesToGb(client.limitBytes)))
  const [expiresAt, setExpiresAt] = useState(client.expiresAt ? client.expiresAt.slice(0, 10) : '')
  const [status, setStatus] = useState(client.status)
  const [note, setNote] = useState(client.note || '')
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const submit = async () => {
    setBusy(true)
    try {
      await api(`/api/admin/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          trafficGb: Number(trafficGb) || 0,
          expiresAt: expiresAt || null,
          status,
          note: note.trim() || undefined,
        }),
      })
      toast.success(t('User updated'))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Update failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Edit user')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>{t('Name *')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('Traffic limit (GB)')}</Label>
              <Input type="number" min="0" value={trafficGb} onChange={(e) => setTrafficGb(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Expires on')}</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('Status')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label={t('Status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="disabled">{t('disabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('Note')}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Config address — the full vless:// link right on the user card, next to the
// action buttons (no longer buried inside the Manage dialog).
// ---------------------------------------------------------------------------

function ConfigAddressBlock({ links, onQr }: { links: string[]; onQr: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useLang()
  if (links.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground">
        {t('No config yet — open Manage and add a proxy account to get its vless:// address')}
      </div>
    )
  }
  const text = links.join('\n')
  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-2.5" dir="ltr">
      <div className="mb-1.5 flex items-center justify-between gap-2" dir="rtl">
        <span className="text-xs font-semibold text-muted-foreground">{t('Config address')}</span>
        <div className="flex shrink-0 items-center gap-1.5" dir="ltr">
          <CopyButton value={text} label={t('Copy')} />
          <Button
            variant="outline"
            size="sm"
            className="px-2"
            aria-label={t('Show QR')}
            onClick={() => onQr(links[0])}
          >
            <QrCode className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="block w-full cursor-pointer text-start"
      >
        <p
          className={`whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/80 ${
            expanded ? '' : 'line-clamp-2'
          }`}
        >
          {text}
        </p>
      </button>
      {links.length > 1 && !expanded && (
        <p className="mt-1 text-[10px] text-muted-foreground" dir="rtl">
          {t('+{n} more config(s) — tap to show all', { n: links.length - 1 })}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail dialog (subscription + accounts)
// ---------------------------------------------------------------------------

function DetailDialog({
  client,
  onOpenChange,
  onChanged,
  onQr,
}: {
  client: ClientRow
  onOpenChange: (v: boolean) => void
  onChanged: () => Promise<void>
  onQr: (value: string) => void
}) {
  const base = originBase()
  const sub = `${base}/api/sub/${client.subToken}`
  const dl = daysLeft(client.expiresAt)
  const { t, lang } = useLang()

  const quick = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      toast.success(msg)
      await onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    }
  }

  const downloadConfig = (p: ProxyRow) => {
    if (!p.serverConfig) return
    const blob = new Blob([JSON.stringify(JSON.parse(p.serverConfig), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${p.remark || p.protocol}-${p.port}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {client.name}
            <StatusBadge
              kind={trafficState(client.usedBytes, client.limitBytes, client.status, client.expiresAt, lang).kind}
              label={trafficState(client.usedBytes, client.limitBytes, client.status, client.expiresAt, lang).label}
            />
          </DialogTitle>
          <DialogDescription>
            {t('Subscription and proxy accounts — everything is served from the domain the panel currently runs on.')}
          </DialogDescription>
        </DialogHeader>

        {/* Subscription */}
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-primary" /> {t('Subscription')}
          </div>
          <CopyField label={t('Subscription link')} value={sub} />
          {client.proxies.length > 0 ? (
            <div className="space-y-1.5" dir="ltr">
              <div className="text-xs font-medium text-muted-foreground" dir="rtl">
                {t('Config address')}
              </div>
              {client.proxies.map((p) => {
                const link = buildShareLink(p)
                if (!link) return null
                return (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 py-1.5">
                      <p className="font-mono text-[11px] leading-relaxed break-all text-muted-foreground">{link}</p>
                    </div>
                    <CopyButton value={link} label={t('Copy')} className="shrink-0" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 px-2"
                      aria-label={t('Show QR')}
                      onClick={() => onQr(link)}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              {t('No config yet — add a proxy account (with a server address) and its vless:// address will appear here')}
            </p>
          )}
          {/* One-tap import into popular clients */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" dir="rtl">
              <Smartphone className="h-3.5 w-3.5" /> {t('Import in one tap')}
            </div>
            <div className="flex flex-wrap gap-1.5" dir="ltr">
              {buildDeepLinks(sub).map((d) => (
                <a key={d.id} href={d.url} aria-label={`${t('Import in one tap')} — ${d.label}`}>
                  <Button variant="outline" size="sm" className="h-8 font-mono">
                    {d.label}
                  </Button>
                </a>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t('Tap an app — it imports the subscription instantly')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onQr(sub)}>
              <QrCode className="h-3.5 w-3.5" /> {t('Show QR')}
            </Button>
            <CopyButton value={`${sub}?format=clash`} label={t('Clash link')} />
            <CopyButton value={`${sub}?format=singbox`} label={t('sing-box link')} />
            <CopyButton value={`${sub}?format=raw`} label={t('Raw links')} />
            <CopyButton value={client.subToken} label={t('Token')} />
          </div>
        </div>

        {/* Quick management */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" size="sm" onClick={() => quick(() => api(`/api/admin/clients/${client.id}`, { method: 'PATCH', body: JSON.stringify({ daysExtend: 30 }) }), t('Extended 30 days'))}>
            <CalendarPlus className="h-3.5 w-3.5" /> {t('+30 days')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => quick(() => api(`/api/admin/clients/${client.id}/traffic`, { method: 'POST', body: JSON.stringify({ reset: true }) }), t('Traffic reset'))}>
            <RotateCcw className="h-3.5 w-3.5" /> {t('Reset traffic')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => quick(() => api(`/api/admin/clients/${client.id}`, { method: 'PATCH', body: JSON.stringify({ status: client.status === 'active' ? 'disabled' : 'active' }) }), client.status === 'active' ? t('disabled') : t('active'))}
          >
            <Zap className="h-3.5 w-3.5" /> {client.status === 'active' ? t('Disable') : t('Enable')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => quick(() => api(`/api/admin/nodes/check`, { method: 'POST', body: JSON.stringify({ all: true }) }), t('Health check started'))}>
            <RefreshCw className="h-3.5 w-3.5" /> {t('Check nodes')}
          </Button>
        </div>

        <Separator />

        {/* Accounts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-primary" /> {t('Proxy accounts ({n})', { n: client.proxies.length })}
            </div>
            <AddAccountButton clientId={client.id} onAdded={onChanged} defaultRemark={client.name} />
          </div>
          {client.proxies.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {t('No accounts yet — add one to populate the subscription.')}
            </p>
          ) : (
            <div className="space-y-3">
              {client.proxies.map((p) => {
                const link = buildShareLink(p)
                return (
                  <div key={p.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono uppercase">{p.protocol}</Badge>
                        <span className="font-medium">{p.remark}</span>
                        {p.fragment ? (
                          <Badge className="bg-odyssey-cyan/15 font-mono text-[10px] text-odyssey-deep ring-1 ring-inset ring-odyssey-cyan/30 dark:text-odyssey-bright" dir="ltr">
                            frg
                          </Badge>
                        ) : null}
                        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {p.address}:{p.port} · {p.transport} · {p.tls ? t('TLS on') : t('TLS off')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.protocol === 'mtproto' && (
                          <a href={buildTelegramTapLink(p)} aria-label={t('Open in Telegram')}>
                            <Button variant="outline" size="sm" className="h-8">
                              <Send className="h-3.5 w-3.5" /> {t('Open in Telegram')}
                            </Button>
                          </a>
                        )}
                        {p.protocol === 'vless' && p.tls && (p.transport || 'ws') === 'ws' && (
                          <ProxyTestButton proxy={p} />
                        )}
                        <CopyButton value={link} label={t('Link')} />
                        <CopyButton value={p.secret} label={t('Secret')} />
                        {p.serverConfig && (
                          <Button variant="outline" size="sm" className="h-8" onClick={() => downloadConfig(p)}>
                            <Download className="h-3.5 w-3.5" /> {t('Config')}
                          </Button>
                        )}
                        <RotateAccountButton proxy={p} onDone={onChanged} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-destructive"
                          aria-label={t('Delete account')}
                          onClick={() => quick(() => api(`/api/admin/proxies/${p.id}`, { method: 'DELETE' }), t('Account removed'))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-24 overflow-y-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed break-all text-muted-foreground" dir="ltr">{link}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Traffic */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">{t('Traffic & expiry')}</div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg border p-2.5">
              <div className="text-xs text-muted-foreground">{t('Used')}</div>
              <div className="font-semibold">{formatBytes(client.usedBytes)}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-xs text-muted-foreground">{t('Limit')}</div>
              <div className="font-semibold">{client.limitBytes > 0 ? formatBytes(client.limitBytes) : t('unlimited')}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-xs text-muted-foreground">{t('Expires')}</div>
              <div className="font-semibold">{client.expiresAt ? formatDate(client.expiresAt, lang) : t('never')}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-xs text-muted-foreground">{t('Days left')}</div>
              <div className="font-semibold">{dl === null ? '∞' : dl > 0 ? dl : 0}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RotateAccountButton({ proxy, onDone }: { proxy: ProxyRow; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const { t } = useLang()
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await api(`/api/admin/proxies/${proxy.id}`, { method: 'PATCH', body: JSON.stringify({ rotateSecret: true }) })
          toast.success(t('Secret rotated — old links stop working'))
          await onDone()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t('Failed'))
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {t('Rotate')}
    </Button>
  )
}

function AddAccountButton({ clientId, onAdded, defaultRemark }: { clientId: string; onAdded: () => Promise<void>; defaultRemark: string }) {
  const [open, setOpen] = useState(false)
  const [protocol, setProtocol] = useState('vless')
  const [backendMode, setBackendMode] = useState<BackendMode>('builtin')
  const [workerId, setWorkerId] = useState('')
  const { data: workersData } = useApi<{ workers: WorkerRow[] }>(open ? '/api/admin/workers' : null)
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('443')
  const [sni, setSni] = useState('')
  const [transport, setTransport] = useState('ws')
  const [path, setPath] = useState('/')
  const [host, setHost] = useState('')
  const [tls, setTls] = useState(true)
  const [fragment, setFragment] = useState('')
  const [remark, setRemark] = useState(`Odyssey-${defaultRemark}`)
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const isMtproto = protocol === 'mtproto'
  const isSingboxLike = protocol === 'hysteria2' || protocol === 'tuic'
  const showStream = STREAM_PROTOS.has(protocol)
  const showFragment = FRAGMENT_PROTOS.has(protocol)
  const usePicker = showStream
  const workers = workersData?.workers
  const pickedWorker = workers?.find((w) => w.id === workerId) || null

  const applyIsp = (isp: (typeof ISP_PRESETS)[number]) => {
    setPort(isp.port)
    setSni(isp.sni)
    if (showStream) setTransport(isp.transport)
    if (showFragment) setFragment(`${isp.length},${isp.interval},${isp.packets}`)
    if (showStream) setBackendMode('own') // manual preset → own server fields
  }

  const submit = async () => {
    const fields = backendSubmitFields(backendMode, pickedWorker, { address, port, sni, host, path, transport, tls })
    if (!fields.address) {
      toast.error(t('Address is required'))
      return
    }
    if (usePicker && backendMode === 'worker' && !pickedWorker) {
      toast.error(t('Pick a worker first (or register one in Nodes & workers)'))
      return
    }
    setBusy(true)
    try {
      await api(`/api/admin/clients/${clientId}/proxies`, {
        method: 'POST',
        body: JSON.stringify({
          protocol, address: fields.address, port: fields.port, sni: fields.sni,
          transport: isMtproto || isSingboxLike ? undefined : fields.transport,
          path: isMtproto || isSingboxLike ? undefined : fields.path,
          host: isMtproto || isSingboxLike ? undefined : fields.host,
          tls: isMtproto || isSingboxLike ? true : fields.tls,
          fragment: showFragment ? fragment.trim() || undefined : undefined,
          remark: remark.trim() || undefined,
        }),
      })
      toast.success(t('Account generated'))
      setOpen(false)
      setAddress(''); setSni(''); setPort('443'); setPath('/'); setFragment('')
      await onAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> {t('Add account')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Add proxy account')}</DialogTitle>
            <DialogDescription>{t('A fresh UUID/password is generated on the server and stored locally.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('Protocol')}</Label>
                <Select value={protocol} onValueChange={setProtocol}>
                  <SelectTrigger aria-label={t('Protocol')}><SelectValue /></SelectTrigger>
                  <SelectContent>{PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('Remark')}</Label>
                <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Odyssey-…" />
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {t('Every config is named Odyssey-… automatically')}
                </p>
              </div>
            </div>
            {protocol !== 'vless' && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                {t('Heads-up: the built-in backend runs vless only. Other protocols need your own server at the address below — otherwise that config will not connect.')}
              </p>
            )}

            {/* Operator quick-fill presets (anti-filter) */}
            {showFragment && (
              <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
                <div className="text-[11px] font-medium text-muted-foreground">{t('Quick fill from operator')}</div>
                <div className="flex flex-wrap gap-1">
                  {ISP_PRESETS.map((isp) => (
                    <button
                      key={isp.id}
                      type="button"
                      onClick={() => applyIsp(isp)}
                      className="rounded-full border bg-white/[0.03] px-2 py-0.5 text-[11px] transition-all hover:-translate-y-0.5 hover:border-odyssey-cyan/40 hover:bg-odyssey-cyan/10 dark:bg-white/[0.04]"
                    >
                      {isp.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Where the config runs (backend source) */}
            {usePicker && (
              <div className="space-y-1.5">
                <Label>{t('Where the config runs')}</Label>
                <BackendPicker
                  mode={backendMode}
                  onModeChange={setBackendMode}
                  workers={workers}
                  workerId={workerId}
                  onWorkerIdChange={setWorkerId}
                />
              </div>
            )}

            {(!usePicker || backendMode === 'own') && (
              <>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{isMtproto ? t('Server address / IP *') : t('Address *')}</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={() => {
                    const r = repairPastedAddress(address)
                    if (r) {
                      setAddress(r.address)
                      if (r.port) setPort(r.port)
                      if (r.path) setPath(r.path)
                      if (r.tls !== undefined) setTls(r.tls)
                      if (r.sni && !sni.trim()) setSni(r.sni)
                      toast.success(t('Pasted URL detected — fields were filled automatically'))
                    }
                  }}
                  placeholder="vps.example.com یا 2001:db8::1 یا https://foo.workers.dev"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('Port *')}</Label>
                <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{isMtproto ? 'FakeTLS domain' : t('SNI')}</Label>
                <Input value={sni} onChange={(e) => setSni(e.target.value)} />
              </div>
              {showStream && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t('Transport')}</Label>
                    <Select value={transport} onValueChange={setTransport}>
                      <SelectTrigger aria-label={t('Transport')}><SelectValue /></SelectTrigger>
                      <SelectContent>{TRANSPORTS.map((tr) => <SelectItem key={tr} value={tr}>{tr}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3">
                    <Label htmlFor="a-tls" className="text-xs">TLS</Label>
                    <Switch id="a-tls" checked={tls} onCheckedChange={setTls} />
                  </div>
                </>
              )}
            </div>
            {showStream && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{transport === 'grpc' ? t('Service name') : t('WS path')}</Label>
                  <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('Host header')}</Label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder={t('optional')} />
                </div>
              </div>
            )}
              </>
            )}
            {showFragment && (
              <div className="space-y-1.5">
                <Label>{t('Fragment (anti-filter)')}</Label>
                <Input value={fragment} onChange={(e) => setFragment(e.target.value)} placeholder="100-200,20-30,tlshello" dir="ltr" className="font-mono text-xs" />
              </div>
            )}
            {isMtproto && (
              <p className="rounded-lg border border-dashed p-2.5 text-xs leading-relaxed text-muted-foreground">{t('MTProto: address = server IP, port = proxy port — the secret is generated automatically. Users open the link in Telegram.')}</p>
            )}
            {isSingboxLike && (
              <p className="rounded-lg border border-dashed p-2.5 text-xs leading-relaxed text-muted-foreground">{t('Hysteria2/TUIC need a sing-box based server (Hiddify, s-ui, …); the config file has both client and server JSON.')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={submit} disabled={busy || (usePicker ? backendMode === 'own' && !address.trim() : !address.trim())}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// client-side link building now uses the shared isomorphic builder in @/lib/links

// ── per-proxy device tunnel test ─────────────────────────────────────────────

function ProxyTestButton({ proxy }: { proxy: ProxyRow }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TunnelTestResult | null>(null)

  const run = async () => {
    setBusy(true)
    setResult(null)
    try {
      const r = await runDeviceTest({
        address: proxy.address.trim(),
        port: Number(proxy.port) || 443,
        path: proxy.path || '/',
        sni: proxy.sni,
        uuid: proxy.secret,
      })
      setResult(r)
    } catch {
      setResult(null)
      toast.error(t('Test failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button variant="outline" size="sm" className="h-8" onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
        {t('Device test')}
      </Button>
      {result && (
        <span className="inline-flex items-center gap-1" title={result.ok ? t('Tunnel works') : t('Blocked on this network')}>
          {result.ok ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {result.steps[2]?.latencyMs ? `${result.steps[2].latencyMs} ms` : t('Tunnel works')}
              </span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{t('Blocked on this network')}</span>
            </>
          )}
        </span>
      )}
    </div>
  )
}
