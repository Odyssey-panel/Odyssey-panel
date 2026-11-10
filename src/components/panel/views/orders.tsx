'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { StatusBadge } from '../status-badge'
import { api, useApi } from '../api'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { Check, X, Image as ImageIcon, RefreshCw, ExternalLink, Loader2 } from 'lucide-react'

type OrderRow = {
  id: string
  tgUserId: string
  tgUsername: string | null
  tgName: string | null
  planName: string
  amount: number
  currency: string
  status: string
  proofFileId: string | null
  clientId: string | null
  createdAt: string
  decidedAt: string | null
}

export function OrdersView() {
  const [filter, setFilter] = useState('all')
  const { data, loading, reload } = useApi<{ orders: OrderRow[] }>(
    filter === 'all' ? '/api/admin/orders' : `/api/admin/orders?status=${filter}`,
    [filter]
  )
  const [proof, setProof] = useState<{ order: OrderRow; open: boolean } | null>(null)
  const [decide, setDecide] = useState<{ order: OrderRow; action: 'approve' | 'reject' } | null>(null)
  const [busy, setBusy] = useState(false)

  const orders = data?.orders ?? []
  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    approved: orders.filter((o) => o.status === 'approved').length,
    rejected: orders.filter((o) => o.status === 'rejected').length,
  }

  const submitDecision = async () => {
    if (!decide) return
    setBusy(true)
    try {
      await api(`/api/admin/orders/${decide.order.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ action: decide.action }),
      })
      toast.success(decide.action === 'approve' ? 'Order approved — subscription created & sent to buyer' : 'Order rejected')
      setDecide(null)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const OrderList = ({ list }: { list: OrderRow[] }) => {
    if (!list.length) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing here yet. Orders appear automatically when buyers upload payment proof in Telegram.
          </CardContent>
        </Card>
      )
    }
    return (
      <div className="space-y-3">
        {list.map((o) => {
          const user = o.tgUsername ? `@${o.tgUsername}` : o.tgName || `id ${o.tgUserId}`
          return (
            <Card key={o.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{user}</span>
                    <StatusBadge kind={o.status as 'pending' | 'approved' | 'rejected'} />
                    <span className="font-mono text-xs text-muted-foreground">#{o.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-medium">{o.planName}</span>
                    <span className="text-muted-foreground"> · {o.amount} {o.currency}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    placed {formatDateTime(o.createdAt)}
                    {o.decidedAt ? ` · decided ${formatDateTime(o.decidedAt)}` : ''}
                    {o.clientId ? ' · subscription created' : ''}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {o.proofFileId && (
                    <Button variant="outline" size="sm" onClick={() => setProof({ order: o, open: true })}>
                      <ImageIcon className="h-3.5 w-3.5" /> Proof
                    </Button>
                  )}
                  {o.status === 'pending' ? (
                    <>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDecide({ order: o, action: 'approve' })}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDecide({ order: o, action: 'reject' })}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  ) : o.clientId ? (
                    <Button variant="outline" size="sm" onClick={() => toast.info('Open Users and search for this buyer to see the subscription')}>
                      <ExternalLink className="h-3.5 w-3.5" /> Subscription
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_8px_oklch(0.62_0.22_293/0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300/90">
              Sales
            </span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Telegram sales flow — buyers pick a plan, upload payment proof, you approve or reject
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {loading && !data ? <Skeleton className="h-24" /> : <OrderList list={orders} />}
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <OrderList list={orders} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <OrderList list={orders} />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <OrderList list={orders} />
        </TabsContent>
      </Tabs>

      {/* Proof viewer */}
      <Dialog open={!!proof?.open} onOpenChange={(v) => setProof((s) => (s ? { ...s, open: v } : s))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment proof</DialogTitle>
            <DialogDescription>
              {proof ? `${proof.order.tgUsername ? '@' + proof.order.tgUsername : proof.order.tgUserId} · ${proof.order.planName} · ${proof.order.amount} ${proof.order.currency}` : ''}
            </DialogDescription>
          </DialogHeader>
          {proof && (
            <img
              src={`/api/admin/orders/${proof.order.id}/proof`}
              alt="Payment proof uploaded by buyer"
              className="max-h-[60vh] w-full rounded-lg border object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Decide confirm */}
      <AlertDialog open={!!decide} onOpenChange={(v) => !v && setDecide(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decide?.action === 'approve' ? 'Approve order?' : 'Reject order?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decide?.action === 'approve'
                ? 'A user with the plan’s traffic limit and expiry is created immediately, the buyer receives their subscription link in Telegram, and (if configured) a sale is posted to your channel.'
                : 'The buyer will be notified that the order was rejected.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={decide?.action === 'approve' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-destructive text-white hover:bg-destructive/90'}
              onClick={submitDecision}
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {decide?.action === 'approve' ? 'Approve & create subscription' : 'Reject order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
