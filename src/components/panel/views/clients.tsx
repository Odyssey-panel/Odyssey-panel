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
} from 'lucide-react'

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

const PROTOCOLS = ['vless', 'vmess', 'trojan', 'shadowsocks'] as const
const TRANSPORTS = ['ws', 'grpc', 'tcp'] as const

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
            return (
              <Card key={c.id} className="transition-colors hover:border-primary/30">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="text-base font-semibold hover:underline"
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
                      <div className="mt-1 text-xs text-muted-foreground">
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
                        <div className="mt-2 max-w-md">
                          <Progress value={pct} aria-label="Traffic used" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setQr({ open: true, value: subUrl(c), name: c.name })}>
                        <QrCode className="h-3.5 w-3.5" /> {t('QR')}
                      </Button>
                      <CopyButton value={subUrl(c)} label={t('Sub link')} />
                      <Button variant="outline" size="sm" onClick={() => setDetail(c)}>
                        <Pencil className="h-3.5 w-3.5" /> {t('Manage')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(c)}
                        aria-label={t('Delete {name}', { name: c.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
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
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('443')
  const [sni, setSni] = useState('')
  const [transport, setTransport] = useState<string>('ws')
  const [path, setPath] = useState('/')
  const [host, setHost] = useState('')
  const [tls, setTls] = useState(true)
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const submit = async () => {
    if (!name.trim()) {
      toast.error(t('Name is required'))
      return
    }
    // A user is valid with just a name. If “generate proxy account” is on but
    // no server address was filled, silently create the user without an
    // account instead of blocking the button (old behavior confused users).
    const withProxy = withAccount && Boolean(address.trim())
    const skippedProxy = withAccount && !address.trim()
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
          address: withProxy ? address.trim() : undefined,
          port: withProxy ? Number(port) : undefined,
          sni: withProxy ? sni.trim() || undefined : undefined,
          transport: withProxy ? transport : undefined,
          path: withProxy ? path.trim() || undefined : undefined,
          host: withProxy ? host.trim() || undefined : undefined,
          tls: withProxy ? tls : undefined,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('New user')}</DialogTitle>
          <DialogDescription>{t('Creates a subscriber with a unique subscription token. Optionally generate the first proxy account.')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">{t('Name *')}</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="alice" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-traffic">{t('Traffic limit (GB, 0 = unlimited)')}</Label>
              <Input id="c-traffic" type="number" min="0" value={trafficGb} onChange={(e) => setTrafficGb(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-days">{t('Valid for (days, 0 = never)')}</Label>
              <Input id="c-days" type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-note">{t('Note')}</Label>
              <Input id="c-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('friend, family, …')} />
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t('Generate proxy account now')}</div>
              <div className="text-xs text-muted-foreground">{t('VLESS/VMess get a UUID; Trojan/SS get a password')}</div>
            </div>
            <Switch checked={withAccount} onCheckedChange={setWithAccount} aria-label={t('Generate proxy account now')} />
          </div>

          {withAccount && (
            <div className="grid gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t('Protocol')}</Label>
                  <Select value={protocol} onValueChange={setProtocol}>
                    <SelectTrigger aria-label={t('Protocol')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t('Server address / IP *')}</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="vps.example.com" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t('Port *')}</Label>
                  <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('SNI / domain')}</Label>
                  <Input value={sni} onChange={(e) => setSni(e.target.value)} placeholder={t('same as address')} />
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border px-3">
                  <Label htmlFor="c-tls" className="text-xs">TLS</Label>
                  <Switch id="c-tls" checked={tls} onCheckedChange={setTls} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t('Transport')}</Label>
                  <Select value={transport} onValueChange={setTransport}>
                    <SelectTrigger aria-label={t('Transport')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRANSPORTS.map((tr) => <SelectItem key={tr} value={tr}>{tr}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{transport === 'grpc' ? t('Service name') : t('WS path')}</Label>
                  <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('Host header')}</Label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder={t('optional')} />
                </div>
              </div>
            </div>
          )}
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
                const link = buildClientLink(p)
                return (
                  <div key={p.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono uppercase">{p.protocol}</Badge>
                        <span className="font-medium">{p.remark}</span>
                        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {p.address}:{p.port} · {p.transport} · {p.tls ? t('TLS on') : t('TLS off')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
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
                    <div className="rounded-md bg-muted/40 p-2 font-mono text-[11px] break-all text-muted-foreground" dir="ltr">{link}</div>
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
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('443')
  const [sni, setSni] = useState('')
  const [transport, setTransport] = useState('ws')
  const [path, setPath] = useState('/')
  const [host, setHost] = useState('')
  const [tls, setTls] = useState(true)
  const [remark, setRemark] = useState(defaultRemark)
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const submit = async () => {
    setBusy(true)
    try {
      await api(`/api/admin/clients/${clientId}/proxies`, {
        method: 'POST',
        body: JSON.stringify({
          protocol, address: address.trim(), port: Number(port), sni: sni.trim() || undefined,
          transport, path: path.trim() || '/', host: host.trim() || undefined, tls, remark: remark.trim() || undefined,
        }),
      })
      toast.success(t('Account generated'))
      setOpen(false)
      setAddress(''); setSni(''); setPort('443'); setPath('/')
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
        <DialogContent className="sm:max-w-md">
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
                <Input value={remark} onChange={(e) => setRemark(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t('Address *')}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="vps.example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('Port *')}</Label>
                <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t('SNI')}</Label>
                <Input value={sni} onChange={(e) => setSni(e.target.value)} />
              </div>
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
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={submit} disabled={busy || !address.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// client-side replica of buildShareLink so links are copyable in the UI
function buildClientLink(p: ProxyRow): string {
  const remark = encodeURIComponent(p.remark || p.protocol)
  const security = p.tls ? 'tls' : 'none'
  const q: string[] = []
  if (p.protocol === 'vless') {
    q.push(`type=${p.transport}`)
    q.push(`security=${security}`)
    if (p.sni) q.push(`sni=${encodeURIComponent(p.sni)}`)
    if (p.host) q.push(`host=${encodeURIComponent(p.host)}`)
    if (p.transport === 'ws' && p.path) q.push(`path=${encodeURIComponent(p.path)}`)
    q.push('fp=chrome')
    return `vless://${p.secret}@${p.address}:${p.port}?${q.join('&')}#${remark}`
  }
  if (p.protocol === 'vmess') {
    const obj = {
      v: '2',
      ps: p.remark,
      add: p.address,
      port: String(p.port),
      id: p.secret,
      aid: '0',
      scy: 'auto',
      net: p.transport,
      type: 'none',
      host: p.host || '',
      path: p.transport === 'ws' ? p.path || '' : '',
      tls: p.tls ? 'tls' : '',
      sni: p.sni || '',
      fp: 'chrome',
    }
    return `vmess://${btoa(JSON.stringify(obj))}`
  }
  if (p.protocol === 'trojan') {
    if (p.sni) q.push(`sni=${encodeURIComponent(p.sni)}`)
    q.push(`type=${p.transport}`)
    return `trojan://${encodeURIComponent(p.secret)}@${p.address}:${p.port}?${q.join('&')}#${remark}`
  }
  return `ss://${btoa(`aes-256-gcm:${p.secret}`)}@${p.address}:${p.port}#${remark}`
}
