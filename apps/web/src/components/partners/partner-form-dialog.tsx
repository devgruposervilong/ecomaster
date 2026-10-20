import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { Handshake, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Partner } from '@tools/shared'
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

export function PartnerFormDialog({
  open,
  onOpenChange,
  partner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  partner?: Partner | null
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const isEditing = Boolean(partner)

  const form = useForm({
    defaultValues: {
      name: partner?.name ?? '',
      type: (partner?.type ?? 'permanente') as 'permanente' | 'bazar',
      currency: (partner?.currency ?? 'USD') as 'USD' | 'EUR' | 'VES',
      status: (partner?.status ?? 'active') as 'active' | 'inactive',
      profitWarehouseCode: partner?.profitWarehouseCode ?? '',
      contactName: partner?.contactName ?? '',
      contactPhone: partner?.contactPhone ?? '',
      contactEmail: partner?.contactEmail ?? '',
      notes: partner?.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      setError(null)

      try {
        if (partner) {
          await apiFetch(`/api/admin/partners/${partner.id}`, {
            method: 'PATCH',
            body: jsonBody({
              name: value.name.trim(),
              type: value.type,
              currency: value.currency,
              status: value.status,
              profitWarehouseCode: value.profitWarehouseCode.trim(),
              contactName: value.contactName.trim(),
              contactPhone: value.contactPhone.trim(),
              contactEmail: value.contactEmail.trim(),
              notes: value.notes.trim(),
            }),
          })
        } else {
          await apiFetch('/api/admin/partners', {
            method: 'POST',
            body: jsonBody({
              name: value.name.trim(),
              type: value.type,
              currency: value.currency,
              profitWarehouseCode: value.profitWarehouseCode.trim(),
              contactName: value.contactName.trim(),
              contactPhone: value.contactPhone.trim(),
              contactEmail: value.contactEmail.trim(),
              notes: value.notes.trim(),
            }),
          })
        }

        await queryClient.invalidateQueries({ queryKey: ['partners'] })
        await queryClient.invalidateQueries({ queryKey: ['partner-options'] })
        await queryClient.invalidateQueries({ queryKey: ['users'] })
        await queryClient.invalidateQueries({ queryKey: ['invites'] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        toast.success(isEditing ? 'Aliado actualizado' : 'Aliado creado')
        onOpenChange(false)
      } catch (submitError) {
        setError(errorMessage(submitError))
      }
    },
  })

  useEffect(() => {
    if (!open) return

    setError(null)
    form.reset({
      name: partner?.name ?? '',
      type: (partner?.type ?? 'permanente') as 'permanente' | 'bazar',
      currency: (partner?.currency ?? 'USD') as 'USD' | 'EUR' | 'VES',
      status: (partner?.status ?? 'active') as 'active' | 'inactive',
      profitWarehouseCode: partner?.profitWarehouseCode ?? '',
      contactName: partner?.contactName ?? '',
      contactPhone: partner?.contactPhone ?? '',
      contactEmail: partner?.contactEmail ?? '',
      notes: partner?.notes ?? '',
    })
  }, [open, partner?.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-black/10 sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            {isEditing ? (
              <Pencil className="size-4 text-[#0A0A0A]" />
            ) : (
              <Handshake className="size-4 text-[#0A0A0A]" />
            )}
          </div>
          <DialogTitle>{isEditing ? 'Editar aliado' : 'Nuevo aliado'}</DialogTitle>
          <DialogDescription>
            Define la moneda base, el tipo de operación y los datos de contacto. Estos datos se
            usarán en ventas, inventario y finanzas.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.Field
            name="name"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Nombre del aliado</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="Ej. MI FLORIS"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 rounded-xl border-black/15"
                  required
                />
              </div>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <form.Field
              name="type"
              children={(field) => (
                <div className="space-y-2">
                  <Label>Tipo de operación</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as 'permanente' | 'bazar')}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanente">Permanente</SelectItem>
                      <SelectItem value="bazar">Bazar / eventual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />

            <form.Field
              name="currency"
              children={(field) => (
                <div className="space-y-2">
                  <Label>Moneda base</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as 'USD' | 'EUR' | 'VES')}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD · Dólar</SelectItem>
                      <SelectItem value="EUR">EUR · Euro</SelectItem>
                      <SelectItem value="VES">VES · Bolívar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />

            {isEditing ? (
              <form.Field
                name="status"
                children={(field) => (
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as 'active' | 'inactive')}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.state.value === 'inactive' ? (
                      <p className="text-[11px] leading-4 text-black/40">
                        Sus usuarios quedarán suspendidos hasta que reactives el aliado.
                      </p>
                    ) : null}
                  </div>
                )}
              />
            ) : (
              <div className="space-y-2">
                <Label>Estado</Label>
                <div className="flex h-11 items-center rounded-xl border border-black/10 bg-black/[0.02] px-3.5 text-sm text-black/45">
                  Activo al crear
                </div>
              </div>
            )}
          </div>

          <form.Field
            name="profitWarehouseCode"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Código de almacén en Profit (opcional)</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="Ej. ALIADO-MF"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 rounded-xl border-black/15"
                />
              </div>
            )}
          />

          <div className="rounded-2xl border border-black/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/35">
              Contacto
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <form.Field
                name="contactName"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Nombre</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="Persona de contacto"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      className="h-11 rounded-xl border-black/15"
                    />
                  </div>
                )}
              />
              <form.Field
                name="contactPhone"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Teléfono / WhatsApp</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="+58 412 000 0000"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      className="h-11 rounded-xl border-black/15"
                    />
                  </div>
                )}
              />
              <form.Field
                name="contactEmail"
                children={(field) => (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={field.name}>Correo</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      placeholder="contacto@aliado.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      className="h-11 rounded-xl border-black/15"
                    />
                  </div>
                )}
              />
            </div>
          </div>

          <form.Field
            name="notes"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Notas internas (opcional)</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  placeholder="Acuerdos, condiciones o detalles de la operación."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          />

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
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting] as const}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isEditing ? 'Guardar cambios' : 'Crear aliado'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
