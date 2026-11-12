import { useEffect, useState } from 'react'
import { Banknote, CreditCard, Landmark, Loader2, Smartphone, Wallet } from 'lucide-react'
import type { Currency, PaymentMethod } from '@ecomaster/shared'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@ecomaster/shared'
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
import { formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PreviewAmounts } from '@/lib/sale-preview'

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  transfer: Landmark,
  pago_movil: Smartphone,
  zelle: Wallet,
  card: CreditCard,
  other: Wallet,
}

export type PosPaymentDraft = {
  currency: Currency
  method: PaymentMethod
  reference: string
  notes: string
}

export function PosCheckoutDialog({
  open,
  onOpenChange,
  preview,
  partnerCurrency,
  payableCurrencies,
  itemCount,
  submitting,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: PreviewAmounts | null
  partnerCurrency: Currency
  payableCurrencies: Currency[]
  itemCount: number
  submitting: boolean
  error: string | null
  onSubmit: (payment: PosPaymentDraft) => void
}) {
  const [currency, setCurrency] = useState<Currency>(partnerCurrency)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setCurrency(partnerCurrency)
    setMethod('cash')
    setReference('')
    setNotes('')
  }, [open, partnerCurrency])

  const amount = preview?.[currency]?.total ?? 0
  const amountVes = preview?.VES.total ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <Banknote className="size-4 text-[#0A0A0A]" />
          </div>
          <DialogTitle>Cobrar venta</DialogTitle>
          <DialogDescription>
            {itemCount} {itemCount === 1 ? 'producto' : 'productos'} · el pago se registra completo
            al confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
              Total a cobrar
            </p>
            <p className="mt-1 text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[#0A0A0A]">
              {formatAmount(amount, currency)}
            </p>
            {currency !== 'VES' ? (
              <p className="mt-1 text-[12px] tabular-nums text-black/45">
                {formatAmount(amountVes, 'VES')}
              </p>
            ) : null}

            {payableCurrencies.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {payableCurrencies.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCurrency(option)}
                    className={cn(
                      'h-8 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors',
                      currency === option
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                        : 'border-black/12 bg-white text-black/55 hover:border-black/25 hover:text-[#0A0A0A]',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((option) => {
                const Icon = METHOD_ICONS[option]
                const active = method === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-[10.5px] font-medium transition-colors',
                      active
                        ? 'border-[#BCD86C] bg-[#F7FBEC] text-[#0A0A0A]'
                        : 'border-black/10 bg-white text-black/50 hover:border-black/20 hover:text-[#0A0A0A]',
                    )}
                  >
                    <Icon className="size-4" />
                    {PAYMENT_METHOD_LABELS[option]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Referencia (opcional)</Label>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ej. Zelle 1234"
                className="h-10 rounded-xl border-black/12"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observación del cobro"
                className="h-10 rounded-xl border-black/12"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-xl border-black/10"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit({ currency, method, reference, notes })}
            disabled={submitting || amount <= 0}
            className="rounded-xl bg-[#BCD86C] px-5 text-[#0A0A0A] hover:bg-[#BCD86C]/85"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Cobrar {formatAmount(amount, currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
