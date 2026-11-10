'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { api, useApi } from '../api'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Package } from 'lucide-react'

type PlanRow = {
  id: string
  name: string
  price: number
  currency: string
  trafficGb: number
  durationDays: number
  description: string | null
  active: boolean
  sort: number
}

export function PlansView() {
  const { data, loading, reload } = useApi<{ plans: PlanRow[] }>('/api/admin/plans')
  const [createOpen, setCreateOpen] = useState(false)
  const [edit, setEdit] = useState<PlanRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null)

  const plans = [...(data?.plans ?? [])].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_8px_oklch(0.62_0.22_293/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300/90">
              Products
            </span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">Plans</h1>
          <p className="text-sm text-muted-foreground">What buyers see when they press /start in your Telegram bot</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No plans yet. Create plans so Telegram buyers can choose.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className={p.active ? '' : 'opacity-60'}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-primary" /> {p.name}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={p.active}
                      onCheckedChange={async (v) => {
                        try {
                          await api(`/api/admin/plans/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: v }) })
                          await reload()
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed')
                        }
                      }}
                      aria-label={`Toggle ${p.name}`}
                    />
                  </div>
                </div>
                <CardDescription>
                  {p.price} {p.currency}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="rounded-lg border p-2">
                    <div className="font-semibold">{p.trafficGb} GB</div>
                    <div className="text-xs text-muted-foreground">traffic</div>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="font-semibold">{p.durationDays} days</div>
                    <div className="text-xs text-muted-foreground">duration</div>
                  </div>
                </div>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanDialog open={createOpen} onOpenChange={setCreateOpen} onDone={async () => { setCreateOpen(false); await reload() }} />
      {edit && (
        <PlanDialog
          open
          plan={edit}
          onOpenChange={(v) => !v && setEdit(null)}
          onDone={async () => { setEdit(null); await reload() }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Existing orders keep their plan snapshot; the plan disappears from the bot&apos;s shop.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  try {
                    await api(`/api/admin/plans/${deleteTarget.id}`, { method: 'DELETE' })
                    toast.success('Plan deleted')
                    await reload()
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed')
                  }
                }
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PlanDialog({ open, onOpenChange, onDone, plan }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void; plan?: PlanRow }) {
  const [name, setName] = useState(plan?.name ?? '')
  const [price, setPrice] = useState(String(plan?.price ?? 3))
  const [currency, setCurrency] = useState(plan?.currency ?? 'USD')
  const [trafficGb, setTrafficGb] = useState(String(plan?.trafficGb ?? 20))
  const [durationDays, setDurationDays] = useState(String(plan?.durationDays ?? 30))
  const [description, setDescription] = useState(plan?.description ?? '')
  const [sort, setSort] = useState(String(plan?.sort ?? 0))
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const body = JSON.stringify({
        name: name.trim(),
        price: Number(price) || 0,
        currency,
        trafficGb: Number(trafficGb) || 10,
        durationDays: Number(durationDays) || 30,
        description: description.trim() || undefined,
        sort: Number(sort) || 0,
      })
      if (plan) {
        await api(`/api/admin/plans/${plan.id}`, { method: 'PATCH', body })
        toast.success('Plan updated')
      } else {
        await api('/api/admin/plans', { method: 'POST', body })
        toast.success('Plan created')
      }
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle>
          <DialogDescription>Shown as tappable buttons in the Telegram bot shop.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Starter" />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="USD" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Traffic (GB)</Label>
              <Input type="number" min="1" value={trafficGb} onChange={(e) => setTrafficGb(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (days)</Label>
              <Input type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="50 GB traffic · 30 days · all locations" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {plan ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
