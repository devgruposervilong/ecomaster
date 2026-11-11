import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { Loader2, MailPlus } from 'lucide-react'
import {
  DEFAULT_COLLABORATOR_MODULES,
  isCollaboratorRole,
  isGlobalRole,
  type InviteRow,
  type ModuleKey,
  type Role,
} from '@ecomaster/shared'
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
import { ModuleAccessPicker } from '@/components/users/module-access-picker'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { partnerOptionsQuery } from '@/lib/queries'

export function InviteUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (payload: { invite: InviteRow; url: string }) => void
}) {
  const queryClient = useQueryClient()
  const partners = useQuery(partnerOptionsQuery)
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
      partnerId: '',
      role: 'partner_collaborator' as Role,
      modules: [...DEFAULT_COLLABORATOR_MODULES] as ModuleKey[],
    },
    onSubmit: async ({ value }) => {
      setError(null)

      if (!isGlobalRole(value.role) && !value.partnerId) {
        setError('Selecciona el aliado al que pertenece el usuario.')
        return
      }

      try {
        const response = await apiFetch<{ data: InviteRow; url: string }>('/api/admin/invites', {
          method: 'POST',
          body: jsonBody({
            email: value.email.trim(),
            partnerId: isGlobalRole(value.role) ? null : value.partnerId,
            role: value.role,
            modules: isCollaboratorRole(value.role) ? value.modules : [],
          }),
        })

        await queryClient.invalidateQueries({ queryKey: ['users'] })
        await queryClient.invalidateQueries({ queryKey: ['invites'] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        onCreated({ invite: response.data, url: response.url })
        onOpenChange(false)
      } catch (submitError) {
        setError(errorMessage(submitError))
      }
    },
  })

  useEffect(() => {
    if (open) {
      setError(null)
      form.reset()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-black/10 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <MailPlus className="size-4 text-[#0A0A0A]" />
          </div>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>
            Genera un enlace de un solo uso. La persona definirá su nombre y contraseña al abrirlo.
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
          <form.Field
            name="email"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Correo electrónico</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  placeholder="persona@correo.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 rounded-xl border-black/15"
                  required
                />
              </div>
            )}
          />

          <form.Subscribe
            selector={(state) => state.values.role}
            children={(role) =>
              isGlobalRole(role) ? (
                <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-3 text-xs leading-5 text-black/50">
                  Este usuario no pertenece a un aliado. Verá la información de todos los aliados
                  únicamente en los módulos que le habilites.
                </div>
              ) : (
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
                      {partners.data?.length === 0 ? (
                        <p className="text-xs text-black/45">
                          Primero crea un aliado en la sección Aliados.
                        </p>
                      ) : null}
                    </div>
                  )}
                />
              )
            }
          />

          <form.Field
            name="role"
            children={(field) => (
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    const nextRole = value as Role
                    field.handleChange(nextRole)
                    form.setFieldValue('partnerId', '')
                    form.setFieldValue(
                      'modules',
                      isCollaboratorRole(nextRole) ? [...DEFAULT_COLLABORATOR_MODULES] : [],
                    )
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl border-black/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner_collaborator">Colaborador del aliado</SelectItem>
                    <SelectItem value="partner_admin">Admin. del aliado</SelectItem>
                    <SelectItem value="collaborator">Colaborador global</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-black/40">
                  El administrador del aliado tiene acceso total dentro de su aliado. El
                  colaborador solo accede a los módulos que le habilites.
                </p>
              </div>
            )}
          />

          <form.Subscribe
            selector={(state) => state.values.role}
            children={(role) =>
              isCollaboratorRole(role) ? (
                <form.Field
                  name="modules"
                  children={(field) => (
                    <div className="space-y-2">
                      <Label>Módulos habilitados</Label>
                      <ModuleAccessPicker
                        value={field.state.value}
                        onChange={(modules) => field.handleChange(modules)}
                      />
                      <p className="text-xs leading-5 text-black/40">
                        Puedes ajustar estos permisos después desde Usuarios.
                      </p>
                    </div>
                  )}
                />
              ) : (
                <div className="rounded-xl bg-black/[0.03] px-3.5 py-3 text-xs leading-5 text-black/45">
                  Este rol tiene acceso a todos los módulos de su alcance.
                </div>
              )
            }
          />

          {error ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl bg-black/[0.03] px-3.5 py-3 text-xs leading-5 text-black/45">
            El enlace vence a los 7 días. Si se genera otro para el mismo correo, el anterior se
            revoca automáticamente.
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
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting] as const}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Generar enlace
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
