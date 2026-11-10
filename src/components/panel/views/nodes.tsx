'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { StatusBadge } from '../status-badge'
import { api, useApi } from '../api'
import { formatDateTime, daysLeft } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { toast } from 'sonner'
import {
  Plus,
  Activity,
  Pencil,
  Trash2,
  Loader2,
  Globe,
} from 'lucide-react'

type NodeRow = {
  id: string
  name: string
  address: string
  port: number
  protocol: string
  tls: boolean
  sni: string | null
  location: string | null
  status: string
  latencyMs: number | null
  certExpiresAt: string | null
  lastCheckedAt: string | null
  note: string | null
}

type WorkerRow = {
  id: string
  name: string
  url: string
  status: string
  latencyMs: number | null
  httpStatus: number | null
  lastCheckedAt: string | null
  note: string | null
}

export function NodesView() {
  const nodesApi = useApi<{ nodes: NodeRow[] }>('/api/admin/nodes')
  const workersApi = useApi<{ workers: WorkerRow[] }>('/api/admin/workers')
  const [checking, setChecking] = useState(false)
  const [addNode, setAddNode] = useState(false)
  const [addWorker, setAddWorker] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'node' | 'worker'; id: string; name: string } | null>(null)
  const [editNode, setEditNode] = useState<NodeRow | null>(null)
  const { t, lang } = useLang()

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn()
      if (msg) toast.success(msg)
      await Promise.all([nodesApi.reload(), workersApi.reload()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    }
  }

  const checkAll = async () => {
    setChecking(true)
    toast.info(t('Running health checks…'))
    try {
      await Promise.all([
        api('/api/admin/nodes/check', { method: 'POST', body: JSON.stringify({ all: true }) }),
        api('/api/admin/workers/check', { method: 'POST', body: JSON.stringify({ all: true }) }),
      ])
      toast.success(t('Health checks complete'))
      await Promise.all([nodesApi.reload(), workersApi.reload()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Check failed'))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-odyssey-navy to-odyssey-cyan shadow-[0_0_8px_oklch(0.72_0.1_214/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-odyssey-cyan/90">
              {t('Infrastructure')}
            </span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">{t('Nodes & Workers')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('Backend servers and worker endpoints with simple TCP/TLS/HTTP health checks — auto-refreshed every 5 minutes')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void checkAll()} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} {t('Check all')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddWorker(true)}>
            <Globe className="h-4 w-4" /> {t('Add worker')}
          </Button>
          <Button size="sm" onClick={() => setAddNode(true)}>
            <Plus className="h-4 w-4" /> {t('Add node')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="nodes">
        <TabsList>
          <TabsTrigger value="nodes">{t('Nodes ({n})', { n: nodesApi.data?.nodes.length ?? 0 })}</TabsTrigger>
          <TabsTrigger value="workers">{t('Workers ({n})', { n: workersApi.data?.workers.length ?? 0 })}</TabsTrigger>
        </TabsList>

        <TabsContent value="nodes" className="mt-4 space-y-3">
          {nodesApi.loading && !nodesApi.data ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-20" />)
          ) : !nodesApi.data?.nodes.length ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t('No nodes yet. Add your VPS / inbound server to start tracking.')}</CardContent></Card>
          ) : (
            nodesApi.data.nodes.map((n) => {
              const certDl = daysLeft(n.certExpiresAt)
              return (
                <Card key={n.id}>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{n.name}</span>
                        <StatusBadge kind={(n.status as 'up' | 'down' | 'unknown') || 'unknown'} />
                        <span className="font-mono text-xs text-muted-foreground">
                          {n.protocol.toUpperCase()} · {n.tls ? 'TLS' : t('plain')}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">{n.address}:{n.port}{n.sni ? ` · SNI ${n.sni}` : ''}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {n.status === 'up' && n.latencyMs !== null ? `⚡ ${n.latencyMs} ms · ` : ''}
                        {certDl !== null ? `${t('cert expires in {d}d', { d: certDl })} · ` : ''}
                        {n.lastCheckedAt ? t('checked {time}', { time: formatDateTime(n.lastCheckedAt, lang) }) : t('never checked')}
                        {n.location ? ` · ${n.location}` : ''}
                        {n.note ? ` · ${n.note}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => run(async () => {
                          await api('/api/admin/nodes/check', { method: 'POST', body: JSON.stringify({ id: n.id }) })
                          toast.success(t('{name} checked', { name: n.name }))
                        })}
                      >
                        <Activity className="h-3.5 w-3.5" /> {t('Check')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditNode(n)} aria-label={t('Edit node')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget({ kind: 'node', id: n.id, name: n.name })}
                        aria-label={t('Delete {name}', { name: n.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="workers" className="mt-4 space-y-3">
          {workersApi.loading && !workersApi.data ? (
            <Skeleton className="h-20" />
          ) : !workersApi.data?.workers.length ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t('No workers yet. Add a Cloudflare worker URL or any HTTP endpoint to monitor.')}</CardContent></Card>
          ) : (
            workersApi.data.workers.map((w) => (
              <Card key={w.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{w.name}</span>
                      <StatusBadge kind={(w.status as 'up' | 'down' | 'unknown') || 'unknown'} />
                      {w.httpStatus !== null && (
                        <span className="font-mono text-xs text-muted-foreground">HTTP {w.httpStatus}</span>
                      )}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground" dir="ltr">{w.url}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {w.status === 'up' && w.latencyMs !== null ? `⚡ ${w.latencyMs} ms · ` : ''}
                      {w.lastCheckedAt ? t('checked {time}', { time: formatDateTime(w.lastCheckedAt, lang) }) : t('never checked')}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => run(async () => {
                        await api('/api/admin/workers/check', { method: 'POST', body: JSON.stringify({ id: w.id }) })
                        toast.success(t('{name} checked', { name: w.name }))
                      })}
                    >
                      <Activity className="h-3.5 w-3.5" /> {t('Check')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteTarget({ kind: 'worker', id: w.id, name: w.name })}
                      aria-label={t('Delete {name}', { name: w.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <AddNodeDialog open={addNode} onOpenChange={setAddNode} onDone={() => run(async () => {}, undefined)} />
      <AddWorkerDialog open={addWorker} onOpenChange={setAddWorker} onDone={() => run(async () => {}, undefined)} />
      {editNode && (
        <EditNodeDialog
          node={editNode}
          onOpenChange={(v) => !v && setEditNode(null)}
          onDone={async () => {
            setEditNode(null)
            await nodesApi.reload()
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget
                ? t('Delete {kind} “{name}”?'.replace('{kind}', t(deleteTarget.kind)), { name: deleteTarget.name })
                : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('Health tracking for this entry will be removed.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  const path = deleteTarget.kind === 'node' ? 'nodes' : 'workers'
                  await run(() => api(`/api/admin/${path}/${deleteTarget.id}`, { method: 'DELETE' }), t('Deleted'))
                }
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

function AddNodeDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('443')
  const [protocol, setProtocol] = useState('vless')
  const [sni, setSni] = useState('')
  const [tls, setTls] = useState(true)
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const submit = async () => {
    setBusy(true)
    try {
      await api('/api/admin/nodes', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), address: address.trim(), port: Number(port), protocol, sni: sni.trim() || undefined, tls, location: location.trim() || undefined }),
      })
      toast.success(t('Node added'))
      setName(''); setAddress(''); setPort('443'); setSni(''); setLocation('')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Add node')}</DialogTitle>
          <DialogDescription>{t('A backend server (VPS / inbound) to watch with TCP + TLS certificate checks.')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('Name *')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Frankfurt-1" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Protocol')}</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger aria-label={t('Protocol')}><SelectValue /></SelectTrigger>
                <SelectContent>{['vless', 'vmess', 'trojan', 'shadowsocks'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>{t('Address *')}</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="1.2.3.4" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Port *')}</Label>
              <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('SNI (for TLS check)')}</Label>
              <Input value={sni} onChange={(e) => setSni(e.target.value)} placeholder="your.domain.com" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Location')}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Frankfurt, DE" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">{t('TLS enabled')}</div>
              <div className="text-xs text-muted-foreground">{t('enables certificate expiry tracking')}</div>
            </div>
            <Switch checked={tls} onCheckedChange={setTls} aria-label="TLS" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={submit} disabled={busy || !name.trim() || !address.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('Add & check later')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditNodeDialog({ node, onOpenChange, onDone }: { node: NodeRow; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [name, setName] = useState(node.name)
  const [address, setAddress] = useState(node.address)
  const [port, setPort] = useState(String(node.port))
  const [sni, setSni] = useState(node.sni || '')
  const [tls, setTls] = useState(node.tls)
  const [location, setLocation] = useState(node.location || '')
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const submit = async () => {
    setBusy(true)
    try {
      await api(`/api/admin/nodes/${node.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), address: address.trim(), port: Number(port), sni: sni.trim() || undefined, tls, location: location.trim() || undefined }),
      })
      toast.success(t('Node updated'))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('Edit node')}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('Name *')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('Port *')}</Label><Input type="number" value={port} onChange={(e) => setPort(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>{t('Address *')}</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('SNI')}</Label><Input value={sni} onChange={(e) => setSni(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('Location')}</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <Label htmlFor="e-tls" className="text-sm">TLS</Label>
            <Switch id="e-tls" checked={tls} onCheckedChange={setTls} />
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

function AddWorkerDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  const submit = async () => {
    setBusy(true)
    try {
      await api('/api/admin/workers', { method: 'POST', body: JSON.stringify({ name: name.trim(), url: url.trim() }) })
      toast.success(t('Worker added'))
      setName(''); setUrl('')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Add worker')}</DialogTitle>
          <DialogDescription>{t('Cloudflare worker, subscription mirror, or any HTTP endpoint to monitor with GET requests.')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>{t('Name *')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="sub-worker" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('URL *')}</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://worker.example.workers.dev" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={submit} disabled={busy || !name.trim() || !url.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('Add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
