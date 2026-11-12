import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { History, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CatalogProduct, ProductChannelPrice } from '@ecomaster/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { currencySymbol, formatAmount } from '@/lib/format'

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
 * Editor inline de disponibilidad y precios por canal. Se usa en la tabla de
 * productos: el switch activa o desactiva el producto en el canal.
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
    <div className="min-w-[220px] divide-y divide-black/[0.04]">
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

  async function commit() {
    if (busy.current) return

    const parsed = parsePrice(value)
    if (parsed === undefined) {
      toast.error('Usa un precio válido')
      setValue(toInputValue(entry.price))
      return
    }

    const priceChanged = entry.itemId === null || parsed !== entry.price
    if (!priceChanged) return

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
          body: jsonBody({ price: parsed }),
        })
      } else {
        await apiFetch(
          `/api/catalog/channels/${entry.channelId}/prices/by-product/${product.id}`,
          {
            method: 'PUT',
            body: jsonBody({ price: parsed, status: 'active' }),
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

  async function toggleAvailability() {
    if (readOnly || busy.current) return

    const nextStatus = entry.available === 'active' ? 'inactive' : 'active'
    busy.current = true
    setSaving(true)

    try {
      await apiFetch(`/api/catalog/products/${product.id}/channels/${entry.channelId}`, {
        method: 'PUT',
        body: jsonBody({ status: nextStatus }),
      })
      await invalidate()
      toast.success(
        nextStatus === 'active'
          ? `Producto activado en ${entry.channelName}`
          : `Producto desactivado en ${entry.channelName}`,
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  const available = entry.available === 'active'
  const statusLabel = !available
    ? 'No disponible'
    : entry.itemId
      ? entry.status === 'active'
        ? 'Activo'
        : 'Inactivo'
      : 'Sin precio'

  return (
    <div className="py-1.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-1.5">
        <Switch
          checked={available}
          onCheckedChange={() => void toggleAvailability()}
          disabled={readOnly || saving}
          title={`${available ? 'Desactivar' : 'Activar'} producto en ${entry.channelName}`}
          aria-label={`Producto activo en ${entry.channelName}`}
          className="shrink-0"
        />

        <span
          className="w-[68px] shrink-0 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45"
          title={entry.channelName}
        >
          {entry.channelName}
        </span>

        {readOnly ? (
          <span className="w-[90px] shrink-0 whitespace-nowrap text-right text-[12px] tabular-nums text-[#0A0A0A]">
            {entry.price === null ? '—' : formatAmount(entry.price, entry.channelCurrency)}
          </span>
        ) : (
          <div className="relative w-[74px] shrink-0">
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

        {entry.itemId && onHistory ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-5 shrink-0 rounded-md text-black/30 hover:text-[#0A0A0A]"
            onClick={() => onHistory(entry.channelId)}
            title={`Historial de ${entry.channelName}`}
          >
            <History className="size-3" />
          </Button>
        ) : null}

        {saving ? <Loader2 className="size-3 shrink-0 animate-spin text-black/35" /> : null}
      </div>

      <p
        className={
          available
            ? 'mt-0.5 truncate pl-[38px] text-[10px] leading-4 text-black/40'
            : 'mt-0.5 truncate pl-[38px] text-[10px] leading-4 text-black/30'
        }
        title={
          !available
            ? 'El producto no está disponible para este canal.'
            : entry.itemId
              ? undefined
              : 'Sin precio: se cobra a mano en la venta'
        }
      >
        {statusLabel}
      </p>
    </div>
  )
}
