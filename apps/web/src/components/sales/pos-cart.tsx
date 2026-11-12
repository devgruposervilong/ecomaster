import { ChevronDown, Minus, Plus, ReceiptText, Store, Trash2, UserRound } from 'lucide-react'
import type { CatalogProduct, Currency, DiscountType } from '@ecomaster/shared'
import { DISCOUNT_TYPE_LABELS } from '@ecomaster/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatAmount, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PreviewAmounts } from '@/lib/sale-preview'
import type { SalesPartnerOption } from '@/lib/queries'

export type PosLine = {
  product: CatalogProduct
  quantity: number
  price: number
  manual: boolean
}

export type PosCartPartner = Pick<SalesPartnerOption, 'id' | 'name' | 'channelName' | 'currency'>

function vesTotal(
  total: number,
  currency: Currency,
  usdRate: number | null,
  eurRate: number | null,
) {
  if (currency === 'VES') return null
  const rate = currency === 'USD' ? usdRate : eurRate
  if (!rate) return null
  return total * rate
}

export function PosCart({
  className,
  partner,
  partnerOptions,
  canSelectPartner,
  onPartnerChange,
  lines,
  manualPrices,
  onQuantityChange,
  onManualPriceChange,
  onRemove,
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  preview,
  currency,
  usdRate,
  eurRate,
  rateDate,
  onCheckout,
  onNewSale,
  onFocusSearch,
  cobrarDisabled,
}: {
  className?: string
  partner: PosCartPartner | null
  partnerOptions: SalesPartnerOption[]
  canSelectPartner: boolean
  onPartnerChange: (partnerId: string) => void
  lines: PosLine[]
  manualPrices: Record<string, string>
  onQuantityChange: (productId: string, quantity: number) => void
  onManualPriceChange: (productId: string, value: string) => void
  onRemove: (productId: string) => void
  discountType: DiscountType
  onDiscountTypeChange: (type: DiscountType) => void
  discountValue: string
  onDiscountValueChange: (value: string) => void
  preview: PreviewAmounts | null
  currency: Currency
  usdRate: number | null
  eurRate: number | null
  rateDate: string | null
  onCheckout: () => void
  onNewSale: () => void
  onFocusSearch: () => void
  cobrarDisabled: boolean
}) {
  const amounts = preview?.[currency] ?? null
  const total = amounts?.total ?? 0
  const totalVes = currency === 'VES' ? null : (preview?.VES.total ?? null)
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  const missingManual = lines.some(
    (line) => line.manual && (manualPrices[line.product.id] ?? '').trim() === '',
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-3xl border border-black/10 bg-white',
        className,
      )}
    >
      <div className="space-y-2.5 border-b border-black/10 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">Venta actual</p>
              <span className="inline-flex shrink-0 items-center rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-black/50">
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-black/40">
              {partner ? `${partner.channelName} · ${partner.currency}` : 'Selecciona el aliado'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onNewSale}
            disabled={lines.length === 0}
            className="rounded-lg text-black/40 hover:text-[#0A0A0A]"
            aria-label="Empezar una venta nueva"
            title="Empezar una venta nueva"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {partner ? (
          canSelectPartner ? (
            <Select value={partner.id} onValueChange={onPartnerChange}>
              <SelectTrigger className="h-10 w-full rounded-xl border-black/12 bg-black/[0.02] text-[12.5px]">
                <span className="flex min-w-0 items-center gap-2">
                  <Store className="size-3.5 shrink-0 text-black/40" />
                  <SelectValue placeholder="Selecciona un aliado" />
                </span>
              </SelectTrigger>
              <SelectContent>
                {partnerOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name} · {option.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
              <Store className="size-3.5 shrink-0 text-black/40" />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-[#0A0A0A]">{partner.name}</p>
                <p className="truncate text-[10.5px] text-black/40">{partner.channelName}</p>
              </div>
            </div>
          )
        ) : (
          <p className="rounded-xl border border-dashed border-black/15 px-3 py-2 text-[11.5px] text-black/45">
            Elige un aliado para cargar su canal de precios.
          </p>
        )}

        <div className="flex items-center gap-2 rounded-xl bg-black/[0.02] px-3 py-2">
          <UserRound className="size-3.5 shrink-0 text-black/35" />
          <p className="flex-1 text-[11.5px] text-black/50">Consumidor final</p>
          <span className="text-[10px] text-black/30">Sin cliente asignado</span>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="grid size-20 place-items-center rounded-2xl bg-black/[0.035]">
            <ReceiptText className="size-9 text-black/15" />
          </div>
          <p className="mt-4 text-[13.5px] font-semibold text-[#0A0A0A]">Empieza una cuenta</p>
          <p className="mt-1 max-w-[230px] text-[11.5px] leading-5 text-black/45">
            Toca un producto o escanea su código: la cuenta se abre sola.
          </p>
          <Button
            type="button"
            onClick={onFocusSearch}
            className="mt-4 h-9 rounded-xl bg-[#0A0A0A] px-3.5 text-[12px] text-white hover:bg-black/85"
          >
            <Plus className="size-3.5" />
            Nueva cuenta
          </Button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {lines.map((line) => {
            const lineTotal = line.price * line.quantity
            const lineVes = vesTotal(lineTotal, currency, usdRate, eurRate)

            return (
              <div
                key={line.product.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-black/[0.06] py-3 last:border-b-0"
              >
                <div className="flex self-center items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRemove(line.product.id)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/[0.05] hover:text-red-600"
                    aria-label={`Quitar ${line.product.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>

                  <div className="inline-flex h-8 shrink-0 items-center rounded-lg border border-black/12">
                    <button
                      type="button"
                      onClick={() => onQuantityChange(line.product.id, line.quantity - 1)}
                      className="flex size-8 items-center justify-center rounded-l-lg text-black/55 transition-colors hover:bg-black/[0.05] hover:text-[#0A0A0A]"
                      aria-label={`Quitar una unidad de ${line.product.name}`}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <input
                      value={line.quantity}
                      onChange={(event) => {
                        const parsed = Math.trunc(Number(event.target.value))
                        onQuantityChange(
                          line.product.id,
                          Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
                        )
                      }}
                      inputMode="numeric"
                      aria-label={`Cantidad de ${line.product.name}`}
                      className="h-8 w-8 border-x border-black/10 bg-transparent text-center text-[12.5px] font-medium tabular-nums text-[#0A0A0A] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onQuantityChange(line.product.id, line.quantity + 1)}
                      className="flex size-8 items-center justify-center rounded-r-lg text-black/55 transition-colors hover:bg-black/[0.05] hover:text-[#0A0A0A]"
                      aria-label={`Agregar una unidad de ${line.product.name}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="line-clamp-3 min-h-[48px] text-[12px] font-medium leading-[1.4] text-[#0A0A0A]">
                    {line.product.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-black/35">
                    {line.product.sku}
                    {line.product.ivaEnabled ? (
                      <span className="rounded bg-black/[0.05] px-1 py-px text-[9px] text-black/45">
                        IVA 16%
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[10.5px] tabular-nums text-black/45">
                    {line.manual
                      ? 'Precio manual'
                      : `${formatAmount(line.price, currency)} c/u`}
                  </p>
                </div>

                <div className="flex w-20 flex-col items-end text-right">
                  <p className="text-[12.5px] font-semibold tabular-nums text-[#0A0A0A]">
                    {formatAmount(lineTotal, currency)}
                  </p>
                  {lineVes !== null ? (
                    <p className="text-[10px] tabular-nums text-black/40">
                      {formatAmount(lineVes, 'VES')}
                    </p>
                  ) : null}
                  {line.manual ? (
                    <Input
                      value={manualPrices[line.product.id] ?? ''}
                      onChange={(event) => onManualPriceChange(line.product.id, event.target.value)}
                      placeholder="Precio"
                      inputMode="decimal"
                      aria-label={`Precio manual de ${line.product.name}`}
                      className={cn(
                        'mt-2 h-8 w-20 rounded-lg border-black/15 text-right text-[12px] tabular-nums',
                        (manualPrices[line.product.id] ?? '').trim() === ''
                          ? 'border-amber-300 bg-amber-50/60'
                          : '',
                      )}
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t border-black/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-black/45">Subtotal</span>
          <span className="text-[12.5px] tabular-nums text-[#0A0A0A]">
            {formatAmount(amounts?.subtotal ?? 0, currency)}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <Select
            value={discountType}
            onValueChange={(value) => onDiscountTypeChange(value as DiscountType)}
          >
            <SelectTrigger
              className="h-8 w-[132px] rounded-lg border-black/12 text-[11px] text-black/60"
              aria-label="Tipo de descuento"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{DISCOUNT_TYPE_LABELS.none}</SelectItem>
              <SelectItem value="amount">{DISCOUNT_TYPE_LABELS.amount}</SelectItem>
              <SelectItem value="percent">{DISCOUNT_TYPE_LABELS.percent}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={discountValue}
            onChange={(event) => onDiscountValueChange(event.target.value)}
            disabled={discountType === 'none'}
            inputMode="decimal"
            aria-label="Valor del descuento"
            className="h-8 flex-1 rounded-lg border-black/12 text-right text-[11.5px] tabular-nums"
          />
          <span className="w-14 shrink-0 text-right text-[11.5px] tabular-nums text-black/50">
            {discountType === 'none' ? '—' : formatAmount(amounts?.discount ?? 0, currency)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-black/45">IVA</span>
          <span className="text-[12.5px] tabular-nums text-[#0A0A0A]">
            {formatAmount(amounts?.iva ?? 0, currency)}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3 border-t border-black/10 pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
              Total
            </p>
            <p className="text-[22px] font-semibold leading-tight tabular-nums tracking-[-0.02em] text-[#0A0A0A]">
              {formatAmount(total, currency)}
            </p>
          </div>
          {totalVes !== null ? (
            <div className="text-right">
              <p className="text-[11.5px] tabular-nums text-black/45">
                {formatAmount(totalVes, 'VES')}
              </p>
              {rateDate ? (
                <p className="text-[9.5px] text-black/30">Tasa BCV {formatDate(rateDate)}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {missingManual ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10.5px] text-amber-800">
            Indica el precio manual de los productos marcados para poder cobrar.
          </p>
        ) : null}

        <Button
          type="button"
          onClick={onCheckout}
          disabled={cobrarDisabled}
          className="mt-3 h-12 w-full rounded-xl bg-[#BCD86C] text-[14px] font-semibold text-[#0A0A0A] hover:bg-[#BCD86C]/85 disabled:bg-black/[0.06] disabled:text-black/30"
        >
          Cobrar
        </Button>
        <button
          type="button"
          onClick={onFocusSearch}
          className="mt-2.5 flex w-full items-center justify-center gap-1 text-[11px] text-black/40 transition-colors hover:text-[#0A0A0A]"
        >
          <ChevronDown className="size-3 rotate-180" />
          Seguir agregando productos
        </button>
      </div>
    </div>
  )
}
