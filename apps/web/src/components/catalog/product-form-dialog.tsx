import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Loader2, Package, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Product, ProductType } from '@ecomaster/shared'
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@ecomaster/shared'
import { ProductComponentsEditor } from '@/components/catalog/product-components-editor'
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
  const [step, setStep] = useState<1 | 2>(1)
  const [savedProduct, setSavedProduct] = useState<Product | null>(null)
  const isEditing = Boolean(product)
  const persistedProduct = savedProduct ?? product ?? null
  const isPromotion = type === 'promotion'

  useEffect(() => {
    if (!open) return

    setError(null)
    setStep(1)
    setSavedProduct(null)
    setSku(product?.sku ?? '')
    setBarcode(product?.barcode ?? '')
    setName(product?.name ?? '')
    setType(product?.type ?? 'article')
    setIvaEnabled(product?.ivaEnabled ?? false)
    setStatus(product?.status ?? 'active')
    setTrackInventory(product?.trackInventory ?? true)
    setCategoryIds(product?.categories.map((category) => category.id) ?? [])
  }, [open, product?.id])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(1)
      setSavedProduct(null)
    }
    onOpenChange(nextOpen)
  }

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

      const response = await apiFetch<{ data: Product }>(
        persistedProduct
          ? `/api/catalog/products/${persistedProduct.id}`
          : '/api/catalog/products',
        { method: persistedProduct ? 'PATCH' : 'POST', body },
      )

      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['channel-prices'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      if (isPromotion) {
        setSavedProduct(response.data)
        setStep(2)
        toast.success(
          persistedProduct
            ? 'Datos de la promoción actualizados'
            : 'Datos de la promoción guardados',
        )
        return
      }

      toast.success(persistedProduct ? 'Producto actualizado' : 'Producto creado')
      handleOpenChange(false)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1rem)] gap-3 overflow-y-auto rounded-2xl border-black/10 p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <div className="mb-0.5 flex size-9 items-center justify-center rounded-2xl bg-[#BCD86C]">
            {step === 2 ? (
              <Boxes className="size-4 text-[#0A0A0A]" />
            ) : isEditing ? (
              <Pencil className="size-4 text-[#0A0A0A]" />
            ) : (
              <Package className="size-4 text-[#0A0A0A]" />
            )}
          </div>
          {isPromotion ? (
            <span className="mb-1 inline-flex w-fit rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-black/45">
              Paso {step} de 2
            </span>
          ) : null}
          <DialogTitle>
            {step === 2
              ? 'Componentes de la promoción'
              : isEditing
                ? 'Editar producto'
                : 'Nuevo producto'}
          </DialogTitle>
          <DialogDescription>
            {step === 2
              ? `${persistedProduct?.name ?? 'La promoción'}: los datos ya están guardados. Selecciona los productos que la componen para poder venderla.`
              : 'El producto es global. El precio se define por canal, no aquí.'}
          </DialogDescription>
          {step === 1 && isPromotion ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[11px] leading-4 text-amber-800">
              Al continuar pasarás al paso 2 para indicar qué productos componen la promoción y
              cuántas unidades descuenta cada venta.
            </p>
          ) : null}
        </DialogHeader>

        {step === 2 ? (
          <ProductComponentsEditor
            product={persistedProduct}
            active={step === 2}
            onCancel={() => setStep(1)}
            cancelLabel="Volver"
            saveLabel={isEditing ? 'Guardar promoción' : 'Crear promoción'}
            successMessage={isEditing ? 'Promoción actualizada' : 'Promoción creada'}
            onSaved={() => handleOpenChange(false)}
          />
        ) : (
          <form className="space-y-2.5" onSubmit={handleSubmit}>
          <div className="grid gap-3 min-[520px]:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / código Profit</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Ej. 1228R"
                className="h-10 rounded-xl border-black/15"
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
                className="h-10 rounded-xl border-black/15"
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
              className="h-10 rounded-xl border-black/15"
              required
            />
          </div>

          <div className="grid gap-3 min-[520px]:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as ProductType)}>
                <SelectTrigger className="h-10 w-full rounded-xl border-black/15">
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
                <SelectTrigger className="h-10 w-full rounded-xl border-black/15">
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
              <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-black/10 p-2 min-[480px]:grid-cols-2 min-[560px]:grid-cols-3">
                {categoryOptions.data.map((category) => {
                  const checked = categoryIds.includes(category.id)

                  return (
                    <label
                      key={category.id}
                      className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-black/[0.03]"
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
                        className="size-4 shrink-0 accent-[#0A0A0A]"
                      />
                      <span className="truncate text-[13px] text-[#0A0A0A]" title={category.name}>
                        {category.name}
                      </span>
                      {category.status === 'inactive' ? (
                        <span className="shrink-0 rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-black/45">
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
            <div className="flex items-center justify-between gap-4 p-3">
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
            <div className="flex items-center justify-between gap-4 p-3">
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

          {error ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2 min-[520px]:flex-row min-[520px]:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
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
              {isPromotion ? 'Continuar' : isEditing ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
