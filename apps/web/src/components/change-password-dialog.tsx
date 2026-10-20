import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth'

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setError(null)

      if (value.newPassword !== value.confirmPassword) {
        setError('Las contraseñas nuevas no coinciden.')
        return
      }

      const result = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      })

      if (result.error) {
        setError(authErrorMessage(result.error, 'No pudimos cambiar la contraseña.'))
        return
      }

      toast.success('Contraseña actualizada. Se cerraron las otras sesiones.')
      onOpenChange(false)
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
      <DialogContent className="rounded-2xl border-black/10 sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#0A0A0A]">
            <KeyRound className="size-4 text-white" />
          </div>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Usa una contraseña de al menos 8 caracteres. Al guardar se cerrarán las demás sesiones
            activas.
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
            name="currentPassword"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Contraseña actual</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
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
            name="newPassword"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Nueva contraseña</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
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

          <form.Field
            name="confirmPassword"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Confirmar contraseña nueva</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
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
