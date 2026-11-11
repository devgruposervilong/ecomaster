import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CalendarDays, Loader2, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import type { Currency, SaleDetail } from '@ecomaster/shared'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_RECORD_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_STATUS_LABELS,
} from '@ecomaster/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch, errorMessage } from '@/lib/api'
import { formatAmount, formatDateTime } from '@/lib/format'
import { meQuery, saleQuery } from '@/lib/queries'

function statusClass(status: string) {
  if (status === 'confirmed' || status === 'paid') return 'bg-[#BCD86C] text-[#0A0A0A]'
  if (status === 'cancelled') return 'bg-black/[0.06] text-black/55'
  if (status === 'partial') return 'bg-amber-100 text-amber-800'
  return 'bg-black/[0.04] text-black/55'
}

export function SaleDetailDialog({
  open,
  onOpenChange,
  saleId,
  showEur,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleId: string | null
  showEur: boolean
}) {
  const queryClient = useQueryClient()
  const me = useQuery(meQuery)
  const isAdmin = me.data?.user.role === 'admin'
  const sale = useQuery({
    ...saleQuery(saleId ?? ''),
    enabled: open && Boolean(saleId),
  })
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const cancel = useMutation({
    mutationFn: () =>
      apiFetch<{ data: SaleDetail }>(`/api/sales/${saleId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
        headers: { 'content-type': 'application/json' },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sale', saleId] })
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Venta anulada')
      setCancelOpen(false)
      setCancelReason('')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const data = sale.data
  const base = data?.currency ?? 'USD'
  const baseAmounts = data?.amounts[base]
  const vesAmounts = data?.amounts.VES
  const eurAmounts = data?.amounts.EUR
  const canSeeEur = isAdmin && showEur

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[94vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-4xl">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
              <ReceiptText className="size-4 text-[#0A0A0A]" />
            </div>
            <DialogTitle>Detalle de la venta</DialogTitle>
            <DialogDescription>
              {data
                ? `${data.partnerName} · ${formatDateTime(data.soldAt)}`
                : 'Cargando la venta…'}
            </DialogDescription>
          </DialogHeader>

          {sale.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-black/45">
              <Loader2 className="mr-2 size-4 animate-spin" /> Cargando venta…
            </div>
          ) : sale.isError || !data ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-sm">
              No pudimos cargar esta venta.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(data.status)}`}
                >
                  {SALE_STATUS_LABELS[data.status]}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(data.paymentStatus)}`}
                >
                  {PAYMENT_STATUS_LABELS[data.paymentStatus]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] text-black/55">
                  <CalendarDays className="size-3" />
                  Tasa {data.rateDate}
                </span>
                <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] text-black/55">
                  {data.channelName} · {data.currency}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Aliado
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#0A0A0A]">{data.partnerName}</p>
                  <p className="text-[11px] text-black/45">{data.partnerRif ?? 'Sin RIF'}</p>
                </div>
                <div className="rounded-2xl border border-black/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Tasas BCV
                  </p>
                  <p className="mt-2 text-sm text-[#0A0A0A]">
                    USD {data.usdRate.toFixed(2)}
                    {data.eurRate !== null ? ` · EUR ${data.eurRate.toFixed(2)}` : ''}
                  </p>
                  <p className="text-[11px] text-black/45">
                    {data.rateSource.toUpperCase()} · {data.rateDate}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-black/10">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-black/[0.02]">
                    <tr>
                      <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Producto
                      </th>
                      <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Cant.
                      </th>
                      <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Precio
                      </th>
                      <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Desc.
                      </th>
                      <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        IVA
                      </th>
                      <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="border-t border-black/[0.06]">
                        <td className="px-3 py-3">
                          <p className="text-[12.5px] font-medium text-[#0A0A0A]">{item.name}</p>
                          <p className="text-[10.5px] text-black/40">{item.sku}</p>
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] tabular-nums">
                          {formatAmount(item.unitPrice, base)}
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] tabular-nums">
                          {formatAmount(item.discount, base)}
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] tabular-nums">
                          {item.ivaEnabled ? formatAmount(item.iva, base) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] font-medium tabular-nums">
                          {formatAmount(item.total, base)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Totales
                  </p>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <TotalRow label="Subtotal" value={baseAmounts?.subtotal ?? 0} currency={base} />
                    <TotalRow
                      label="Descuento"
                      value={-(baseAmounts?.discount ?? 0)}
                      currency={base}
                    />
                    <TotalRow label="IVA" value={baseAmounts?.iva ?? 0} currency={base} />
                    <div className="my-2 border-t border-black/10" />
                    <TotalRow
                      label="Total"
                      value={baseAmounts?.total ?? 0}
                      currency={base}
                      strong
                    />
                    {data.currency !== 'VES' ? (
                      <TotalRow
                        label="Total VES"
                        value={vesAmounts?.total ?? 0}
                        currency="VES"
                      />
                    ) : null}
                    {canSeeEur && data.currency !== 'EUR' ? (
                      <TotalRow
                        label="Total EUR"
                        value={eurAmounts?.total ?? 0}
                        currency="EUR"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Pagos
                  </p>
                  <div className="mt-3 space-y-2">
                    {data.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-xl border border-black/[0.07] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12.5px] font-medium text-[#0A0A0A]">
                            {formatAmount(payment.amount, payment.currency)}
                          </p>
                          <span className="text-[10px] uppercase tracking-[0.1em] text-black/40">
                            {PAYMENT_RECORD_STATUS_LABELS[payment.status]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-black/45">
                          {PAYMENT_METHOD_LABELS[payment.method]}
                          {payment.reference ? ` · ${payment.reference}` : ''}
                        </p>
                        <p className="text-[10.5px] text-black/35">
                          {formatAmount(payment.amountVes, 'VES')} · {formatDateTime(payment.paidAt)}
                        </p>
                      </div>
                    ))}
                    {data.payments.length === 0 ? (
                      <p className="text-sm text-black/45">Sin pagos registrados.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {data.notes ? (
                <div className="rounded-2xl border border-black/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Notas
                  </p>
                  <p className="mt-2 text-sm text-black/60">{data.notes}</p>
                </div>
              ) : null}

              {data.status === 'cancelled' ? (
                <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4 text-sm text-black/60">
                  Venta anulada por {data.cancelledByName ?? '—'} el{' '}
                  {formatDateTime(data.cancelledAt)}
                  {data.cancelReason ? `: ${data.cancelReason}` : '.'}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            {isAdmin && data?.status === 'confirmed' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
              >
                <Ban className="size-4" />
                Anular venta
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-black/10"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="rounded-2xl border-black/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anular venta</DialogTitle>
            <DialogDescription>
              La venta quedará anulada y sus pagos se anularán. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Ej. Venta duplicada"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
              className="rounded-xl border-black/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
              className="rounded-xl bg-[#0A0A0A] text-white hover:bg-black/85"
            >
              {cancel.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Anular venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TotalRow({
  label,
  value,
  currency,
  strong,
}: {
  label: string
  value: number
  currency: Currency
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? 'font-medium text-[#0A0A0A]' : 'text-black/50'}>{label}</span>
      <span
        className={
          strong
            ? 'text-base font-semibold tabular-nums text-[#0A0A0A]'
            : 'tabular-nums text-[#0A0A0A]'
        }
      >
        {formatAmount(value, currency)}
      </span>
    </div>
  )
}
