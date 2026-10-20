import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Role, UserRow } from '@tools/shared'
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
import { useMe } from '@/lib/auth-context'
import { partnerOptionsQuery } from '@/lib/queries'

export function EditUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const me = useMe()
  const queryClient = useQueryClient()
  const partners = useQuery(partnerOptionsQuery)
  const [error, setError] = useState<string | null>(null)
  const isSelf = user.id === me.user.id

  const form = useForm({
    defaultValues: {
      name: user.name,
      role: user.role as Role,
      partnerId: user.partnerId ?? '',
    },
    onSubmit: async ({ value }) => {
      setError(null)

      if (value.role !== 'admin' && !value.partnerId) {
        setError('Selecciona el aliado al que pertenece el usuario.')
        return
      }

      try {
        await apiFetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          body: jsonBody({
            name: value.name.trim(),
            role: value.role,
            partnerId: value.role === 'admin' ? null : value.partnerId,
          }),
        })

        await queryClient.invalidateQueries({ queryKey: ['users'] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        await queryClient.invalidateQueries({ queryKey: ['me'] })
        toast.success('Usuario actualizado')
        onOpenChange(false)
      } catch (submitError) {
        setError(errorMessage(submitError))
      }
    },
  })

  useEffect(() => {
    if (open) {
      setError(null)
      form.reset({
        name: user.name,
        role: user.role as Role,
        partnerId: user.partnerId ?? '',
      })
    }
  }, [open, user.id, user.name, user.role, user.partnerId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-black/10 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <Pencil className="size-4 text-[#0A0A0A]" />
          </div>
          <DialogTitle>Editar acceso</DialogTitle>
          <DialogDescription>
            Cambia el nombre, el rol o el aliado de {user.name}.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input
              value={user.email}
              readOnly
              className="h-11 rounded-xl border-black/10 bg-black/[0.02] text-black/55"
            />
          </div>

          <form.Field
            name="name"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Nombre</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 rounded-xl border-black/15"
                  required
                />
              </div>
            )}
          />

          <form.Field
            name="role"
            children={(field) => (
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    const role = value as Role
                    field.handleChange(role)
                    if (role === 'admin') form.setFieldValue('partnerId', '')
                  }}
                  disabled={isSelf}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner_operator">Operador</SelectItem>
                    <SelectItem value="partner_admin">Admin. del aliado</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                {isSelf ? (
                  <p className="text-xs text-black/45">
                    No puedes quitarte el rol de administrador.
                  </p>
                ) : null}
              </div>
            )}
          />

          <form.Subscribe
            selector={(state) => state.values.role}
            children={(role) =>
              role === 'admin' ? null : (
                <form.Field
                  name="partnerId"
                  children={(field) => (
                    <div className="space-y-2">
                      <Label>Aliado</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value)}
                        disabled={partners.isLoading}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                          <SelectValue
                            placeholder={
                              partners.isLoading ? 'Cargando aliados…' : 'Selecciona un aliado'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {partners.data?.map((partner) => (
                            <SelectItem key={partner.id} value={partner.id}>
                              {partner.name} · {partner.currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              )
            }
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
                  Guardar cambios
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
