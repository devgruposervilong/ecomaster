import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, History, Loader2 } from 'lucide-react'
import type { Channel, Product } from '@ecomaster/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatAmount, formatDateTime } from '@/lib/format'
import { productHistoryQuery } from '@/lib/queries'

export function ProductHistoryDialog({
  open,
  onOpenChange,
  product,
  channels,
  initialChannelId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  channels: Channel[]
  initialChannelId?: string | null
}) {
  const defaultChannelId = initialChannelId ?? channels[0]?.id ?? ''
  const [channelId, setChannelId] = useState(defaultChannelId)

  useEffect(() => {
    if (!open) return
    setChannelId(initialChannelId ?? channels[0]?.id ?? '')
  }, [open, initialChannelId, channels, product?.id])

  const selectedChannel = channels.find((channel) => channel.id === channelId)

  const history = useQuery({
    ...productHistoryQuery(product?.id ?? '', channelId),
    enabled: open && Boolean(product) && Boolean(channelId),
  })

  const entries = history.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <History className="size-4 text-[#0A0A0A]" />
          </div>
          <DialogTitle>Historial de precios</DialogTitle>
          <DialogDescription>
            {product
              ? `${product.name}${selectedChannel ? ` · ${selectedChannel.name}` : ''}`
              : 'Selecciona un producto para ver sus cambios.'}
          </DialogDescription>
        </DialogHeader>

        {channels.length === 0 ? (
          <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-sm text-black/55">
            Crea un canal de precios para consultar el historial.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
              Canal de precios
            </p>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className="h-10 w-full rounded-xl border-black/15">
                <SelectValue placeholder="Selecciona un canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name} · {channel.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {channels.length === 0 ? null : history.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-black/45">
            <Loader2 className="mr-2 size-4 animate-spin" /> Cargando historial…
          </div>
        ) : history.isError ? (
          <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-sm">
            No pudimos cargar el historial. Intenta de nuevo.
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-black/45">
            Todavía no hay cambios de precio registrados en este canal.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-black/[0.07] px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#0A0A0A]">
                  {entry.oldPrice === null ? (
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                      Precio inicial
                    </span>
                  ) : (
                    <>
                      <span className="text-black/45 line-through">
                        {formatAmount(entry.oldPrice, entry.currency)}
                      </span>
                      <ArrowRight className="size-3.5 text-black/30" />
                    </>
                  )}
                  <span className="font-medium">
                    {formatAmount(entry.newPrice, entry.currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-black/40">
                  {entry.changedByName} · {formatDateTime(entry.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="pt-2">
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
  )
}
