import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Eye, Plus, ReceiptText, Search, ShoppingCart } from 'lucide-react'
import {
  PAYMENT_STATUS_LABELS,
  SALE_STATUS_LABELS,
} from '@ecomaster/shared'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { SaleDetailDialog } from '@/components/sales/sale-detail-dialog'
import { SaleFormDialog } from '@/components/sales/sale-form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatAmount, formatDateTime } from '@/lib/format'
import { meQuery, salesQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/ventas')({
  component: SalesPage,
})

const PAGE_SIZE = 20

function statusClass(status: string) {
  if (status === 'confirmed' || status === 'paid') return 'bg-[#BCD86C] text-[#0A0A0A]'
  if (status === 'cancelled') return 'bg-black/[0.06] text-black/55'
  if (status === 'partial') return 'bg-amber-100 text-amber-800'
  return 'bg-black/[0.04] text-black/55'
}

function SalesPage() {
  const me = useQuery(meQuery)
  const isAdmin = me.data?.user.role === 'admin'
  const isGlobal = isAdmin || me.data?.user.role === 'collaborator'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'confirmed' | 'cancelled'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [showEur, setShowEur] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const sales = useQuery(
    salesQuery({
      search: search.trim() || undefined,
      status: status === 'all' ? undefined : status,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
  )

  const rows = sales.data?.data ?? []
  const meta = sales.data?.meta

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operación"
        title="Ventas"
        description={
          isGlobal
            ? 'Registra ventas de cualquier aliado. El servidor calcula los importes, congela la tasa BCV y guarda la venta como confirmada.'
            : 'Registra tus ventas con la moneda de tu canal. El pago se registra completo al crear la venta.'
        }
        actions={
          <>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEur((current) => !current)}
                className="rounded-xl border-black/15"
              >
                <Eye className="size-4" />
                {showEur ? 'Ocultar EUR' : 'Mostrar EUR'}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
            >
              <Plus className="size-4" />
              Nueva venta
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/35" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar por aliado o número de venta…"
            className="h-10 rounded-xl border-black/15 pl-10"
          />
        </div>

        <Input
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value)
            setPage(1)
          }}
          className="h-10 rounded-xl border-black/15 lg:w-40"
          aria-label="Desde"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value)
            setPage(1)
          }}
          className="h-10 rounded-xl border-black/15 lg:w-40"
          aria-label="Hasta"
        />

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as typeof status)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-10 w-full rounded-xl border-black/15 lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="confirmed">Confirmadas</SelectItem>
            <SelectItem value="cancelled">Anuladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
        {sales.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-black/[0.04]" />
            ))}
          </div>
        ) : sales.isError ? (
          <div className="px-5 py-10 text-center text-sm text-black/55">
            No pudimos cargar las ventas. Intenta de nuevo.
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Todavía no hay ventas"
            description="Registra la primera venta para empezar a ver los totales en la moneda del aliado y en bolívares."
            action={
              <Button
                type="button"
                onClick={() => setFormOpen(true)}
                className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
              >
                <Plus className="size-4" />
                Nueva venta
              </Button>
            }
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-black/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Venta
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Aliado
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Total VES
                  </th>
                  {isAdmin && showEur ? (
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                      Total EUR
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Pago
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Ver
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-t border-black/[0.06] hover:bg-black/[0.015]"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[12.5px] font-medium text-[#0A0A0A]">
                        {formatDateTime(sale.soldAt)}
                      </p>
                      <p className="text-[10.5px] text-black/35">
                        #{sale.id.slice(-8).toUpperCase()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12.5px] font-medium text-[#0A0A0A]">
                        {sale.partnerName}
                      </p>
                      <p className="text-[10.5px] text-black/40">{sale.channelName}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-[12.5px] font-semibold tabular-nums text-[#0A0A0A]">
                        {formatAmount(
                          sale.amounts[sale.currency]?.total ?? 0,
                          sale.currency,
                        )}
                      </p>
                      <p className="text-[10.5px] text-black/35">{sale.currency}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-black/60">
                      {formatAmount(sale.amounts.VES?.total ?? 0, 'VES')}
                    </td>
                    {isAdmin && showEur ? (
                      <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-black/60">
                        {sale.amounts.EUR
                          ? formatAmount(sale.amounts.EUR.total, 'EUR')
                          : '—'}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-medium ${statusClass(sale.paymentStatus)}`}
                      >
                        {PAYMENT_STATUS_LABELS[sale.paymentStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-medium ${statusClass(sale.status)}`}
                      >
                        {SALE_STATUS_LABELS[sale.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto rounded-lg text-black/45 hover:text-[#0A0A0A]"
                        onClick={() => setDetailId(sale.id)}
                      >
                        <ReceiptText className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3">
            <p className="text-xs text-black/45">
              Página {meta.page} de {meta.totalPages} · {meta.total} venta(s)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg border-black/10"
                disabled={meta.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg border-black/10"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <SaleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(sale) => setDetailId(sale.id)}
      />
      <SaleDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => {
          if (!next) setDetailId(null)
        }}
        saleId={detailId}
        showEur={showEur}
      />
    </div>
  )
}
