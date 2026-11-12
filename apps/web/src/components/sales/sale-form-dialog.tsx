import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calculator, Loader2, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type {
  Currency,
  CurrencyAmounts,
  DiscountType,
  PaymentMethod,
  SaleDetail,
} from '@ecomaster/shared'
import {
  DISCOUNT_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import {
  meQuery,
  productsQuery,
  salesPartnerOptionsQuery,
  salesRateQuery,
} from '@/lib/queries'

type PreviewAmounts = Record<Currency, CurrencyAmounts>

function toCents(value: number) {
  return Math.round(value * 100)
}

function fromCents(cents: number) {
  return Math.round(cents) / 100
}

function allocate(subtotals: number[], discountCents: number) {
  const total = subtotals.reduce((sum, value) => sum + value, 0)
  if (discountCents === 0 || total === 0) return subtotals.map(() => 0)

  const allocations = subtotals.map((subtotal) => {
    const exact = (discountCents * subtotal) / total
    const floor = Math.floor(exact)
    return { floor, remainder: exact - floor }
  })
  let remaining = discountCents - allocations.reduce((sum, item) => sum + item.floor, 0)
  const order = allocations
    .map((item, index) => ({ index, remainder: item.remainder }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  const result = allocations.map((item) => item.floor)

  for (let index = 0; index < order.length && remaining > 0; index += 1) {
    const target = order[index]!
    if (target.remainder > 0 || remaining >= order.length) {
      result[target.index] = (result[target.index] ?? 0) + 1
      remaining -= 1
    }
  }
  return result
}

function calculatePreview({
  currency,
  usdRate,
  eurRate,
  lines,
  discountType,
  discountValue,
}: {
  currency: Currency
  usdRate: number
  eurRate: number
  lines: Array<{ price: number; quantity: number; ivaEnabled: boolean }>
  discountType: DiscountType
  discountValue: number
}): PreviewAmounts | null {
  if (lines.length === 0 || usdRate <= 0 || eurRate <= 0) return null

  const lineCents = lines.map((line) => ({
    subtotal: toCents(line.price) * line.quantity,
    ivaEnabled: line.ivaEnabled,
  }))
  const subtotalCents = lineCents.reduce((sum, line) => sum + line.subtotal, 0)
  let discountCents = 0

  if (discountType === 'amount') {
    discountCents = Math.min(toCents(discountValue), subtotalCents)
  } else if (discountType === 'percent') {
    const percent = Math.min(Math.max(discountValue, 0), 100)
    discountCents = Math.round((subtotalCents * percent) / 100)
  }

  const discounts = allocate(
    lineCents.map((line) => line.subtotal),
    discountCents,
  )
  const vesRate = currency === 'USD' ? usdRate : currency === 'EUR' ? eurRate : 1
  let subtotal = 0
  let discount = 0
  let iva = 0
  let total = 0
  let subtotalVes = 0
  let discountVes = 0
  let totalVes = 0

  lineCents.forEach((line, index) => {
    const lineDiscount = discounts[index] ?? 0
    const net = line.subtotal - lineDiscount
    const lineIva = line.ivaEnabled ? Math.round(net * 0.16) : 0
    const lineTotal = net + lineIva
    const lineVes = Math.round(lineTotal * vesRate)

    subtotal += line.subtotal
    discount += lineDiscount
    iva += lineIva
    total += lineTotal
    subtotalVes += Math.round(line.subtotal * vesRate)
    discountVes += Math.round(lineDiscount * vesRate)
    totalVes += lineVes
  })

  const base: CurrencyAmounts = {
    subtotal: fromCents(subtotal),
    discount: fromCents(discount),
    iva: fromCents(iva),
    total: fromCents(total),
  }
  const ves: CurrencyAmounts = {
    subtotal: fromCents(subtotalVes),
    discount: fromCents(discountVes),
    iva: fromCents(totalVes - subtotalVes + discountVes),
    total: fromCents(totalVes),
  }
  const third = (rate: number): CurrencyAmounts => {
    const thirdSubtotal = Math.round(subtotalVes / rate)
    const thirdDiscount = Math.round(discountVes / rate)
    const thirdTotal = Math.round(totalVes / rate)
    return {
      subtotal: fromCents(thirdSubtotal),
      discount: fromCents(thirdDiscount),
      iva: fromCents(thirdTotal - thirdSubtotal + thirdDiscount),
      total: fromCents(thirdTotal),
    }
  }

  return {
    USD: currency === 'USD' ? base : third(usdRate),
    EUR: currency === 'EUR' ? base : third(eurRate),
    VES: ves,
  }
}

export function SaleFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (sale: SaleDetail) => void
}) {
  const queryClient = useQueryClient()
  const me = useQuery(meQuery)
  const isAdmin = me.data?.user.role === 'admin'
  const isGlobal = me.data?.user.role === 'admin' || me.data?.user.role === 'collaborator'

  const [partnerId, setPartnerId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({})
  const [pickerProductId, setPickerProductId] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState('0')
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('USD')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const partners = useQuery({
    ...salesPartnerOptionsQuery,
    enabled: open,
  })
  const partnerOptions = partners.data ?? []
  const selectedPartner =
    partnerOptions.find(
      (partner) => partner.id === (isGlobal ? partnerId : me.data?.partner?.id),
    ) ?? null

  useEffect(() => {
    if (!open) return
    if (!isGlobal && me.data?.partner?.id) setPartnerId(me.data.partner.id)
  }, [open, isGlobal, me.data?.partner?.id])

  useEffect(() => {
    if (!open) return
    setQuantities({})
    setManualPrices({})
    setPickerProductId('')
    setDiscountType('none')
    setDiscountValue('0')
    setReference('')
    setNotes('')
    setError(null)
  }, [open, partnerId])

  useEffect(() => {
    if (selectedPartner) setPaymentCurrency(selectedPartner.currency)
  }, [selectedPartner?.id])

  const products = useQuery({
    ...productsQuery({
      channelId: isGlobal ? selectedPartner?.channelId : undefined,
      status: 'active',
      pageSize: 500,
    }),
    enabled: open && Boolean(selectedPartner),
  })
  const rate = useQuery({ ...salesRateQuery, enabled: open })
  const productRows = products.data?.data ?? []
  const productById = useMemo(
    () => new Map(productRows.map((product) => [product.id, product])),
    [productRows],
  )
  const selectedLines = Object.entries(quantities)
    .map(([productId, quantity]) => ({ product: productById.get(productId), quantity }))
    .filter((line): line is { product: NonNullable<typeof line.product>; quantity: number } =>
      Boolean(line.product),
    )

  function isManualPrice(product: { price: number | null; priceStatus: string | null }) {
    return isAdmin && !(product.price !== null && product.priceStatus === 'active')
  }

  const effectivePrices = useMemo(() => {
    const prices = new Map<string, number>()

    for (const product of productRows) {
      if (product.price !== null && product.priceStatus === 'active') {
        prices.set(product.id, product.price)
        continue
      }

      const parsed = Number((manualPrices[product.id] ?? '').trim().replace(',', '.'))
      prices.set(product.id, Number.isFinite(parsed) && parsed >= 0 ? parsed : 0)
    }

    return prices
  }, [productRows, manualPrices])

  const payableCurrencies = useMemo(() => {
    if (!selectedPartner) return [] as Currency[]
    const values: Currency[] = [selectedPartner.currency]
    if (selectedPartner.currency !== 'VES') values.push('VES')
    if (isAdmin) {
      for (const currency of ['USD', 'EUR'] as Currency[]) {
        if (!values.includes(currency)) values.push(currency)
      }
    }
    return values
  }, [isAdmin, selectedPartner])

  const preview = useMemo(() => {
    if (!selectedPartner || !rate.data) return null
    return calculatePreview({
      currency: selectedPartner.currency,
      usdRate: rate.data.usdRate,
      eurRate: rate.data.eurRate ?? 1,
      lines: selectedLines.map((line) => ({
        price: effectivePrices.get(line.product.id) ?? 0,
        quantity: line.quantity,
        ivaEnabled: line.product.ivaEnabled,
      })),
      discountType,
      discountValue: Number(discountValue.replace(',', '.')) || 0,
    })
  }, [selectedPartner, rate.data, selectedLines, effectivePrices, discountType, discountValue])

  const availableProducts = productRows.filter(
    (product) =>
      !quantities[product.id] &&
      product.available !== 'inactive' &&
      (isAdmin || (product.price !== null && product.priceStatus === 'active')),
  )

  function addProduct() {
    if (!pickerProductId) return
    setQuantities((current) => ({ ...current, [pickerProductId]: 1 }))
    setPickerProductId('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPartner || selectedLines.length === 0) return
    setError(null)

    const missingManual = selectedLines.find((line) => {
      if (!isManualPrice(line.product)) return false
      const raw = (manualPrices[line.product.id] ?? '').trim()
      if (!raw) return true
      const parsed = Number(raw.replace(',', '.'))
      return !Number.isFinite(parsed) || parsed < 0
    })

    if (missingManual) {
      setError(`Indica el precio manual de ${missingManual.product.name}.`)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await apiFetch<{ data: SaleDetail }>('/api/sales', {
        method: 'POST',
        body: jsonBody({
          partnerId: selectedPartner.id,
          items: selectedLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            ...(isManualPrice(line.product)
              ? { unitPrice: (manualPrices[line.product.id] ?? '').trim().replace(',', '.') }
              : {}),
          })),
          discountType,
          discountValue: discountType === 'none' ? 0 : discountValue.replace(',', '.'),
          payment: {
            currency: paymentCurrency,
            method: paymentMethod,
            reference: reference.trim() || undefined,
          },
          notes: notes.trim() || undefined,
        }),
      })

      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Venta registrada')
      onCreated?.(response.data)
      onOpenChange(false)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-5xl">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <ShoppingCart className="size-4 text-[#0A0A0A]" />
          </div>
          <DialogTitle>Nueva venta</DialogTitle>
          <DialogDescription>
            El servidor calcula los importes y guarda la tasa BCV del día. La venta se confirma al
            crearse y no se puede editar.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Aliado</Label>
              <Select
                value={selectedPartner?.id ?? ''}
                onValueChange={(value) => {
                  setPartnerId(value)
                  setQuantities({})
                }}
                disabled={!isGlobal}
              >
                <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                  <SelectValue placeholder="Selecciona un aliado" />
                </SelectTrigger>
                <SelectContent>
                  {partnerOptions.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name} · {partner.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPartner ? (
                <p className="text-[11px] text-black/40">
                  {selectedPartner.channelName} · {selectedPartner.currency}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Pago</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={paymentCurrency}
                  onValueChange={(value) => setPaymentCurrency(value as Currency)}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {payableCurrencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-black/40">
                Se registra el pago completo del total en la moneda elegida.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Agregar producto</Label>
                <Select
                  value={pickerProductId}
                  onValueChange={setPickerProductId}
                  disabled={!selectedPartner || availableProducts.length === 0}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                    <SelectValue
                      placeholder={
                        selectedPartner
                          ? 'Selecciona un producto del canal'
                          : 'Selecciona un aliado primero'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                        {isManualPrice(product) && selectedPartner
                          ? ' · se cobra a mano'
                          : product.price !== null && selectedPartner
                            ? ` · ${formatAmount(product.price, selectedPartner.currency)}`
                            : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={addProduct}
                disabled={!pickerProductId}
                className="h-11 rounded-xl bg-[#0A0A0A] text-white hover:bg-black/85"
              >
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>

            {selectedLines.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-black/45">
                Agrega al menos un producto para calcular la venta.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {selectedLines.map((line) => (
                  <div
                    key={line.product.id}
                    className="grid gap-2 rounded-xl border border-black/[0.07] p-3 sm:grid-cols-[1fr_110px_100px_120px_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#0A0A0A]">
                        {line.product.name}
                      </p>
                      <p className="text-[11px] text-black/40">
                        {line.product.sku} ·{' '}
                        {isManualPrice(line.product)
                          ? 'Precio manual'
                          : formatAmount(
                              effectivePrices.get(line.product.id) ?? 0,
                              selectedPartner?.currency ?? 'USD',
                            )}
                        {line.product.ivaEnabled ? ' · IVA 16%' : ' · exento'}
                      </p>
                    </div>
                    {isManualPrice(line.product) ? (
                      <Input
                        value={manualPrices[line.product.id] ?? ''}
                        onChange={(event) =>
                          setManualPrices((current) => ({
                            ...current,
                            [line.product.id]: event.target.value,
                          }))
                        }
                        placeholder="Precio manual"
                        inputMode="decimal"
                        aria-label={`Precio manual de ${line.product.name}`}
                        className="h-9 rounded-lg border-black/15 text-right tabular-nums"
                      />
                    ) : (
                      <p className="text-right text-[12px] tabular-nums text-black/60">
                        {formatAmount(
                          effectivePrices.get(line.product.id) ?? 0,
                          selectedPartner?.currency ?? 'USD',
                        )}
                      </p>
                    )}
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [line.product.id]: Math.max(
                            1,
                            Math.trunc(Number(event.target.value)) || 1,
                          ),
                        }))
                      }
                      className="h-9 rounded-lg border-black/15 text-right tabular-nums"
                    />
                    <p className="text-right text-[13px] font-semibold tabular-nums text-[#0A0A0A]">
                      {formatAmount(
                        (effectivePrices.get(line.product.id) ?? 0) * line.quantity,
                        selectedPartner?.currency ?? 'USD',
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="justify-self-end rounded-lg text-black/40 hover:text-red-600"
                      onClick={() => {
                        setQuantities((current) => {
                          const next = { ...current }
                          delete next[line.product.id]
                          return next
                        })
                        setManualPrices((current) => {
                          const next = { ...current }
                          delete next[line.product.id]
                          return next
                        })
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Descuento global</Label>
              <Select
                value={discountType}
                onValueChange={(value) => setDiscountType(value as DiscountType)}
              >
                <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{DISCOUNT_TYPE_LABELS.none}</SelectItem>
                  <SelectItem value="amount">{DISCOUNT_TYPE_LABELS.amount}</SelectItem>
                  <SelectItem value="percent">{DISCOUNT_TYPE_LABELS.percent}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{discountType === 'percent' ? 'Porcentaje' : 'Monto'}</Label>
              <Input
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                disabled={discountType === 'none'}
                inputMode="decimal"
                className="h-11 rounded-xl border-black/15 text-right tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label>Referencia del pago (opcional)</Label>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ej. Zelle 1234"
                className="h-11 rounded-xl border-black/15"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_320px]">
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observaciones de la venta."
                className="min-h-[120px]"
              />
            </div>

            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Calculator className="size-4 text-black/45" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
                  Resumen
                </p>
              </div>
              {!rate.data ? (
                <p className="mt-3 text-sm text-amber-700">
                  No hay tasa BCV disponible. No se puede calcular la venta.
                </p>
              ) : !preview || !selectedPartner ? (
                <p className="mt-3 text-sm text-black/45">Agrega productos para ver los totales.</p>
              ) : (
                <div className="mt-3 space-y-1.5 text-sm">
                  <Row
                    label="Subtotal"
                    value={formatAmount(
                      preview[selectedPartner.currency].subtotal,
                      selectedPartner.currency,
                    )}
                  />
                  <Row
                    label="Descuento"
                    value={`− ${formatAmount(
                      preview[selectedPartner.currency].discount,
                      selectedPartner.currency,
                    )}`}
                  />
                  <Row
                    label="IVA"
                    value={formatAmount(
                      preview[selectedPartner.currency].iva,
                      selectedPartner.currency,
                    )}
                  />
                  <div className="my-2 border-t border-black/10" />
                  <Row
                    label="Total"
                    value={formatAmount(
                      preview[selectedPartner.currency].total,
                      selectedPartner.currency,
                    )}
                    strong
                  />
                  {selectedPartner.currency !== 'VES' ? (
                    <Row label="Total VES" value={formatAmount(preview.VES.total, 'VES')} />
                  ) : null}
                  {isAdmin && selectedPartner.currency !== 'EUR' ? (
                    <Row label="Total EUR" value={formatAmount(preview.EUR.total, 'EUR')} />
                  ) : null}
                  <p className="pt-2 text-[10px] leading-4 text-black/40">
                    Tasa BCV del {rate.data.date}: USD {rate.data.usdRate}
                    {rate.data.eurRate !== null ? ` · EUR ${rate.data.eurRate}` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-black/10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedPartner || selectedLines.length === 0 || !rate.data}
              className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Registrar venta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
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
        {value}
      </span>
    </div>
  )
}
