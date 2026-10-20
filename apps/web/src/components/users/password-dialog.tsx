import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { UserRow } from '@tools/shared'
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
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'

export function PasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { newPassword: '' },
    onSubmit: async ({ value }) => {
      setError(null)

      try {
        await apiFetch(`/api/admin/users/${user.id}/password`, {
          method: 'POST',
          body: jsonBody({ newPassword: value.newPassword }),
        })

        await queryClient.invalidateQueries({ queryKey: ['users'] })
        toast.success('Contraseña actualizada. Se cerraron las sesiones del usuario.')
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
  }, [open, user.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-black/10 sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#0A0A0A]">
            <KeyRound className="size-4 text-white" />
          </div>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Define una contraseña temporal para {user.name}. Compártela por un canal seguro.
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
            name="newPassword"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Nueva contraseña</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 rounded-xl border-black/15"
                  minLength={8}
                  required
                />
              </div>
            )}
          />

          <div className="rounded-xl bg-black/[0.03] px-3.5 py-3 text-xs leading-5 text-black/45">
            Al guardar se cerrarán todas las sesiones activas del usuario. Deberá iniciar sesión de
            nuevo con la nueva contraseña.
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
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting] as const}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="rounded-xl bg-[#0A0A0A] text-white hover:bg-black/85"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Guardar contraseña
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
