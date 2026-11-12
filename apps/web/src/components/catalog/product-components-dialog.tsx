import { Boxes } from 'lucide-react'
import type { Product } from '@ecomaster/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProductComponentsEditor } from '@/components/catalog/product-components-editor'

export function ProductComponentsDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}) {
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

        <ProductComponentsEditor
          product={product}
          active={open}
          onCancel={() => onOpenChange(false)}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
