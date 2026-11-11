import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Product } from '@ecomaster/shared'
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
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { productComponentsQuery, productsQuery } from '@/lib/queries'

type ComponentRow = {
  componentProductId: string
  quantity: string
}

export function ProductComponentsDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<ComponentRow[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const existing = useQuery({
    ...productComponentsQuery(product?.id ?? ''),
    enabled: open && Boolean(product),
  })
  const products = useQuery({
    ...productsQuery({ pageSize: 500, status: 'active' }),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return

    setRows(
      (existing.data ?? []).map((component) => ({
        componentProductId: component.componentProductId,
        quantity: String(component.quantity),
      })),
    )
  }, [open, existing.data])

  const options = useMemo(() => {
    return (products.data?.data ?? []).filter(
      (item) => item.id !== product?.id && item.type !== 'promotion',
    )
  }, [products.data, product?.id])

  async function save() {
    if (!product) return
    setIsSaving(true)

    try {
      await apiFetch(`/api/catalog/products/${product.id}/components`, {
        method: 'PUT',
        body: jsonBody({
          components: rows.map((row, index) => ({
            componentProductId: row.componentProductId,
            quantity: Number(row.quantity) || 0,
            position: index,
          })),
        }),
      })
      await queryClient.invalidateQueries({ queryKey: ['product-components', product.id] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Componentes actualizados')
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <Boxes className="size-4 text-[#0A0A0A]" />
          </div>
          <DialogTitle>Componentes de la promoción</DialogTitle>
          <DialogDescription>
            {product
              ? `${product.name}. Al vender esta promoción, el inventario se descuenta de los componentes.`
              : 'Selecciona una promoción.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={`${row.componentProductId}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <div className="space-y-2">
                <Label>Producto componente</Label>
                <Select
                  value={row.componentProductId}
                  onValueChange={(value) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, componentProductId: value } : item,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.sku} · {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  value={row.quantity}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                  inputMode="numeric"
                  className="h-11 rounded-xl border-black/15 text-right tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl border-black/10 text-black/45 hover:text-red-600"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl border-dashed border-black/15"
            onClick={() => setRows((current) => [...current, { componentProductId: '', quantity: '1' }])}
          >
            <Plus className="size-4" />
            Agregar componente
          </Button>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-5 text-amber-800">
              Una promoción debe tener al menos un componente para poder venderse.
            </p>
          ) : null}
        </div>

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
            type="button"
            onClick={save}
            disabled={isSaving || rows.length === 0 || rows.some((row) => !row.componentProductId)}
            className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar componentes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
