import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Package, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Product, ProductType } from '@ecomaster/shared'
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@ecomaster/shared'
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
import { Switch } from '@/components/ui/switch'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { categoryOptionsQuery } from '@/lib/queries'

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
}) {
  const queryClient = useQueryClient()
  const categoryOptions = useQuery({ ...categoryOptionsQuery, enabled: open })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<ProductType>('article')
  const [ivaEnabled, setIvaEnabled] = useState(false)
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [trackInventory, setTrackInventory] = useState(true)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const isEditing = Boolean(product)

  useEffect(() => {
    if (!open) return

    setError(null)
    setSku(product?.sku ?? '')
    setBarcode(product?.barcode ?? '')
    setName(product?.name ?? '')
    setType(product?.type ?? 'article')
    setIvaEnabled(product?.ivaEnabled ?? false)
    setStatus(product?.status ?? 'active')
    setTrackInventory(product?.trackInventory ?? true)
    setCategoryIds(product?.categories.map((category) => category.id) ?? [])
  }, [open, product?.id])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const body = jsonBody({
        sku: sku.trim(),
        barcode: barcode.trim(),
        name: name.trim(),
        type,
        ivaEnabled,
        status,
        trackInventory,
        categoryIds,
      })

      if (product) {
        await apiFetch(`/api/catalog/products/${product.id}`, { method: 'PATCH', body })
      } else {
        await apiFetch('/api/catalog/products', { method: 'POST', body })
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['channel-prices'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(isEditing ? 'Producto actualizado' : 'Producto creado')
      onOpenChange(false)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-xl">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            {isEditing ? (
              <Pencil className="size-4 text-[#0A0A0A]" />
            ) : (
              <Package className="size-4 text-[#0A0A0A]" />
            )}
          </div>
          <DialogTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            El producto es global. El precio se define por canal, no aquí.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / código Profit</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Ej. 1228R"
                className="h-11 rounded-xl border-black/15"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Código de barras (opcional)</Label>
              <Input
                id="barcode"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Ej. 7591234567890"
                className="h-11 rounded-xl border-black/15"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Shampoo de coco 500 ml"
              className="h-11 rounded-xl border-black/15"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as ProductType)}>
                <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRODUCT_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as 'active' | 'inactive')}
              >
                <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categorías</Label>
              <span className="text-[11px] text-black/40">
                {categoryIds.length} seleccionada{categoryIds.length === 1 ? '' : 's'}
              </span>
            </div>
            {categoryOptions.isLoading ? (
              <div className="h-20 animate-pulse rounded-xl bg-black/[0.04]" />
            ) : categoryOptions.data && categoryOptions.data.length > 0 ? (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-black/10 p-2">
                {categoryOptions.data.map((category) => {
                  const checked = categoryIds.includes(category.id)

                  return (
                    <label
                      key={category.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[0.03]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setCategoryIds((current) =>
                            event.target.checked
                              ? [...current, category.id]
                              : current.filter((id) => id !== category.id),
                          )
                        }
                        className="size-4 accent-[#0A0A0A]"
                      />
                      <span className="text-[13px] text-[#0A0A0A]">{category.name}</span>
                      {category.status === 'inactive' ? (
                        <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-black/45">
                          Inactiva
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-black/15 px-3.5 py-3 text-[11px] leading-5 text-black/45">
                Todavía no hay categorías. Créalas desde la pestaña Categorías del catálogo.
              </p>
            )}
          </div>

          <div className="divide-y divide-black/[0.06] rounded-2xl border border-black/10">
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Label htmlFor="ivaEnabled" className="text-sm font-medium text-[#0A0A0A]">
                  Cobra IVA (16%)
                </Label>
                <p className="mt-1 text-[11px] leading-4 text-black/40">
                  Se aplica sobre la línea después del descuento global.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span
                  className={
                    ivaEnabled
                      ? 'text-[11px] font-medium text-[#0A0A0A]'
                      : 'text-[11px] font-medium text-black/40'
                  }
                >
                  {ivaEnabled ? 'Activo' : 'Inactivo'}
                </span>
                <Switch
                  id="ivaEnabled"
                  checked={ivaEnabled}
                  onCheckedChange={setIvaEnabled}
                  aria-label="Activar IVA"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Label htmlFor="trackInventory" className="text-sm font-medium text-[#0A0A0A]">
                  Controlar inventario
                </Label>
                <p className="mt-1 text-[11px] leading-4 text-black/40">
                  En promociones, el inventario se descuenta de sus componentes.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span
                  className={
                    trackInventory
                      ? 'text-[11px] font-medium text-[#0A0A0A]'
                      : 'text-[11px] font-medium text-black/40'
                  }
                >
                  {trackInventory ? 'Activo' : 'Inactivo'}
                </span>
                <Switch
                  id="trackInventory"
                  checked={trackInventory}
                  onCheckedChange={setTrackInventory}
                  aria-label="Controlar inventario"
                />
              </div>
            </div>
          </div>

          {type === 'promotion' ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-5 text-amber-800">
              Después de guardar la promoción, usa el botón de componentes para indicar qué
              productos la componen y cuántas unidades descuenta cada venta.
            </p>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-sm">
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
              disabled={isSubmitting || !sku.trim() || !name.trim()}
              className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEditing ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
