import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { History, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CatalogProduct, ProductChannelPrice } from '@ecomaster/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { currencySymbol, formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'

function toInputValue(price: number | null) {
  return price === null ? '' : price.toFixed(2).replace('.', ',')
}

function parsePrice(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

/**
 * Editor inline de precios por canal. Se usa en la tabla de productos y en el
 * diálogo «Cambiar precios…».
 */
export function ProductChannelPrices({
  product,
  onHistory,
  readOnly = false,
}: {
  product: CatalogProduct
  onHistory?: (channelId: string) => void
  readOnly?: boolean
}) {
  if (product.prices.length === 0) {
    return <span className="text-[12px] text-black/35">Sin canales de precios</span>
  }

  return (
    <div className="min-w-[350px] divide-y divide-black/[0.04]">
      {product.prices.map((entry) => (
        <ChannelPriceRow
          key={entry.channelId}
          product={product}
          entry={entry}
          onHistory={onHistory}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

function ChannelPriceRow({
  product,
  entry,
  onHistory,
  readOnly,
}: {
  product: CatalogProduct
  entry: ProductChannelPrice
  onHistory?: (channelId: string) => void
  readOnly: boolean
}) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(toInputValue(entry.price))
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    setValue(toInputValue(entry.price))
  }, [entry.price, entry.itemId])

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['products'] })
    await queryClient.invalidateQueries({ queryKey: ['channel-prices', entry.channelId] })
    await queryClient.invalidateQueries({ queryKey: ['channels'] })
    await queryClient.invalidateQueries({ queryKey: ['product-history'] })
  }

  async function commit(nextStatus?: 'active' | 'inactive') {
    if (busy.current) return

    const parsed = parsePrice(value)
    if (parsed === undefined) {
      toast.error('Usa un precio válido')
      setValue(toInputValue(entry.price))
      return
    }

    const status = nextStatus ?? entry.status ?? 'active'
    const priceChanged = entry.itemId === null || parsed !== entry.price
    const statusChanged = entry.status !== status

    if (!priceChanged && !statusChanged) return

    busy.current = true
    setSaving(true)

    try {
      if (parsed === null) {
        if (!entry.itemId) return
        await apiFetch(`/api/catalog/channels/${entry.channelId}/prices/${entry.itemId}`, {
          method: 'DELETE',
        })
        toast.success('Precio quitado del canal')
      } else if (entry.itemId) {
        await apiFetch(`/api/catalog/channels/${entry.channelId}/prices/${entry.itemId}`, {
          method: 'PATCH',
          body: jsonBody({ price: parsed, ...(statusChanged ? { status } : {}) }),
        })
      } else {
        await apiFetch(
          `/api/catalog/channels/${entry.channelId}/prices/by-product/${product.id}`,
          {
            method: 'PUT',
            body: jsonBody({ price: parsed, status }),
          },
        )
      }

      await invalidate()
    } catch (error) {
      toast.error(errorMessage(error))
      setValue(toInputValue(entry.price))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  function toggle() {
    void commit(entry.status === 'active' ? 'inactive' : 'active')
  }

  return (
    <div className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
      <span
        className="w-[96px] shrink-0 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45"
        title={entry.channelName}
      >
        {entry.channelName}
      </span>

      {readOnly ? (
        <span className="w-[110px] shrink-0 whitespace-nowrap text-right text-[12px] tabular-nums text-[#0A0A0A]">
          {entry.price === null ? '—' : formatAmount(entry.price, entry.channelCurrency)}
        </span>
      ) : (
        <div className="relative w-[92px] shrink-0">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-black/35">
            {currencySymbol(entry.channelCurrency)}
          </span>
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            placeholder="—"
            inputMode="decimal"
            disabled={saving}
            aria-label={`Precio de ${product.name} en ${entry.channelName}`}
            className="h-8 rounded-lg border-black/15 pl-6 pr-2 text-right text-[12px] tabular-nums"
          />
        </div>
      )}

      {entry.itemId ? (
        <button
          type="button"
          role="switch"
          aria-checked={entry.status === 'active'}
          aria-label={`Activar precio en ${entry.channelName}`}
          onMouseDown={readOnly ? undefined : (event) => event.preventDefault()}
          onClick={readOnly ? undefined : toggle}
          disabled={readOnly || saving}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
            entry.status === 'active' ? 'bg-[#0A0A0A]' : 'bg-black/15',
            saving && 'opacity-50',
            readOnly && 'cursor-default',
          )}
        >
          <span
            className={cn(
              'inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform',
              entry.status === 'active' ? 'translate-x-[18px]' : 'translate-x-[3px]',
            )}
          />
        </button>
      ) : null}

      <span className="min-w-0 flex-1 truncate text-[10px] leading-4 text-black/40">
        {entry.itemId
          ? entry.status === 'active'
            ? 'Activo'
            : 'Inactivo'
          : 'Sin precio · se cobra a mano'}
      </span>

      {entry.itemId && onHistory ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6 shrink-0 rounded-md text-black/30 hover:text-[#0A0A0A]"
          onClick={() => onHistory(entry.channelId)}
          title={`Historial de ${entry.channelName}`}
        >
          <History className="size-3" />
        </Button>
      ) : null}

      {saving ? <Loader2 className="size-3 shrink-0 animate-spin text-black/35" /> : null}
    </div>
  )
}
