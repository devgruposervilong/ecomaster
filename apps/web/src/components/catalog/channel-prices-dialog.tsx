import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import type { Channel } from '@ecomaster/shared'
import { ProductChannelPrices } from '@/components/catalog/channel-price-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { productsQuery } from '@/lib/queries'

const PAGE_SIZE = 50

export function ChannelPricesDialog({
  open,
  onOpenChange,
  channels,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channels: Channel[]
}) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [page, setPage] = useState(1)

  const products = useQuery({
    ...productsQuery({
      search: deferredSearch.trim() || undefined,
      status: 'active',
      page,
      pageSize: PAGE_SIZE,
    }),
    enabled: open,
  })

  const rows = products.data?.data ?? []
  const meta = products.data?.meta

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Precios por canal</DialogTitle>
          <DialogDescription>
            Define el precio de cada producto en cada canal. El cambio se guarda al salir del
            campo. Si un precio queda inactivo o vacío, solo un administrador puede cobrarlo a
            mano en la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/35" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Buscar por nombre o SKU…"
              className="h-10 rounded-xl border-black/15 pl-10"
            />
          </div>
          <span className="whitespace-nowrap text-xs text-black/40">
            {meta?.total ?? 0} producto(s) · {channels.length} canal(es)
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/10">
          {products.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-black/[0.04]" />
              ))}
            </div>
          ) : products.isError ? (
            <div className="px-5 py-10 text-center text-sm text-black/55">
              No pudimos cargar los productos. Intenta de nuevo.
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-black/45">
              No hay productos activos para mostrar.
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-black/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Precios por canal
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
                  <tr key={product.id} className="border-t border-black/[0.06] align-top">
                    <td className="w-[280px] px-4 py-4">
                      <p className="text-[13px] font-medium text-[#0A0A0A]">{product.name}</p>
                      <p className="text-[11px] text-black/40">{product.sku}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ProductChannelPrices product={product} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-black/45">
              Página {meta.page} de {meta.totalPages}
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

        <p className="text-[11px] leading-5 text-black/40">
          Los precios se guardan en la base con punto decimal. En la interfaz se muestran con coma
          y miles según la configuración de Venezuela.
        </p>
      </DialogContent>
    </Dialog>
  )
}
