import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ListPlus, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Channel, Currency } from '@ecomaster/shared'
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

export function ChannelFormDialog({
  open,
  onOpenChange,
  channel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel?: Channel | null
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = Boolean(channel)

  useEffect(() => {
    if (!open) return

    setName(channel?.name ?? '')
    setCurrency(channel?.currency ?? 'USD')
    setStatus(channel?.status ?? 'active')
    setDescription(channel?.description ?? '')
    setError(null)
  }, [open, channel?.id])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const body = jsonBody({
        name: name.trim(),
        currency,
        status,
        description: description.trim(),
      })

      if (channel) {
        await apiFetch(`/api/catalog/channels/${channel.id}`, { method: 'PATCH', body })
      } else {
        await apiFetch('/api/catalog/channels', { method: 'POST', body })
      }

      await queryClient.invalidateQueries({ queryKey: ['channels'] })
      await queryClient.invalidateQueries({ queryKey: ['channel-options'] })
      await queryClient.invalidateQueries({ queryKey: ['partner-options'] })
      await queryClient.invalidateQueries({ queryKey: ['sales-partner-options'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(isEditing ? 'Canal actualizado' : 'Canal creado')
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
              <ListPlus className="size-4 text-[#0A0A0A]" />
            )}
          </div>
          <DialogTitle>{isEditing ? 'Editar canal de precios' : 'Nuevo canal de precios'}</DialogTitle>
          <DialogDescription>
            La moneda del canal debe coincidir con la de todos los aliados que lo usen. Varios
            aliados pueden compartir el mismo canal.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="channel-name">Nombre</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Principal"
              className="h-11 rounded-xl border-black/15"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD · Dólar</SelectItem>
                  <SelectItem value="EUR">EUR · Euro</SelectItem>
                  <SelectItem value="VES">VES · Bolívar</SelectItem>
                </SelectContent>
              </Select>
              {isEditing ? (
                <p className="text-[11px] leading-4 text-black/40">
                  No se puede cambiar si el canal ya tiene aliados o ventas.
                </p>
              ) : null}
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
            <Label htmlFor="channel-description">Descripción (opcional)</Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Condiciones o vigencia del canal."
            />
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
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEditing ? 'Guardar cambios' : 'Crear canal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
