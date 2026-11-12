import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Tags } from 'lucide-react'
import { toast } from 'sonner'
import type { Category } from '@ecomaster/shared'
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

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = Boolean(category)

  useEffect(() => {
    if (!open) return

    setName(category?.name ?? '')
    setDescription(category?.description ?? '')
    setStatus(category?.status ?? 'active')
    setError(null)
  }, [open, category?.id])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const body = jsonBody({
        name: name.trim(),
        description: description.trim(),
        status,
      })

      if (category) {
        await apiFetch(`/api/catalog/categories/${category.id}`, {
          method: 'PATCH',
          body,
        })
      } else {
        await apiFetch('/api/catalog/categories', { method: 'POST', body })
      }

      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['category-options'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(isEditing ? 'Categoría actualizada' : 'Categoría creada')
      onOpenChange(false)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            {isEditing ? (
              <Pencil className="size-4 text-[#0A0A0A]" />
            ) : (
              <Tags className="size-4 text-[#0A0A0A]" />
            )}
          </div>
          <DialogTitle>{isEditing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>
            Las categorías son globales y un producto puede pertenecer a varias a la vez.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. SHAMPOO"
              className="h-11 rounded-xl border-black/15"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-description">Descripción (opcional)</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Uso o características de esta categoría."
            />
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
                <SelectItem value="active">Activa</SelectItem>
                <SelectItem value="inactive">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              disabled={isSubmitting || name.trim().length < 2}
              className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEditing ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
