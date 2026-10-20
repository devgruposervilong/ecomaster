import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { ArrowRight, Loader2, Mail, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_LABELS } from '@tools/shared'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { invitePreviewQuery, meQuery } from '@/lib/queries'

export const Route = createFileRoute('/invitacion/$token')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (me) throw redirect({ to: '/' })
  },
  component: InvitationPage,
})

function InvitationPage() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const preview = useQuery(invitePreviewQuery(token))
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: '',
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setError(null)

      if (value.password !== value.confirmPassword) {
        setError('Las contraseñas no coinciden.')
        return
      }

      try {
        await apiFetch(`/api/invites/${token}/accept`, {
          method: 'POST',
          body: jsonBody({
            name: value.name.trim(),
            password: value.password,
          }),
        })

        await queryClient.invalidateQueries({ queryKey: ['me'] })
        toast.success('Tu cuenta está lista. Bienvenido al backoffice.')
        await navigate({ to: '/' })
      } catch (submitError) {
        setError(errorMessage(submitError))
      }
    },
  })

  if (preview.isLoading) {
    return (
      <AuthShell
        headline="Tu acceso al backoffice de Eco Master."
        description="Estamos validando tu enlace de invitación."
        bullets={['Enlace de un solo uso', 'Acceso aislado por aliado', 'Trazabilidad para Profit']}
      >
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3 rounded-lg bg-black/[0.05]" />
          <Skeleton className="h-4 w-full rounded-lg bg-black/[0.05]" />
          <Skeleton className="h-24 w-full rounded-2xl bg-black/[0.05]" />
          <Skeleton className="h-11 w-full rounded-xl bg-black/[0.05]" />
          <Skeleton className="h-11 w-full rounded-xl bg-black/[0.05]" />
        </div>
      </AuthShell>
    )
  }

  if (preview.isError || !preview.data) {
    return (
      <AuthShell
        headline="Este enlace ya no está disponible."
        description="Las invitaciones son personales, de un solo uso y vencen a los 7 días."
        bullets={[
          'Enlace de un solo uso',
          'Vence a los 7 días',
          'Puede ser revocado por el administrador',
        ]}
      >
        <div className="rounded-3xl border border-black/10 bg-white p-7">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-black">
            <ShieldAlert className="size-5 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[#0A0A0A]">
            Invitación no válida
          </h1>
          <p className="mt-2 text-sm leading-6 text-black/50">{errorMessage(preview.error)}</p>
          <p className="mt-3 text-sm leading-6 text-black/50">
            Pide al administrador de Eco Master que genere un enlace nuevo.
          </p>
          <Button
            asChild
            className="mt-6 h-11 w-full rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
          >
            <Link to="/login">
              Ir a iniciar sesión
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  const invite = preview.data

  return (
    <AuthShell
      headline={`Bienvenido a ${invite.partnerName}.`}
      description="Completa tu nombre y crea una contraseña para activar tu acceso al backoffice. El enlace solo puede usarse una vez."
      bullets={[
        `Acceso como ${ROLE_LABELS[invite.role]}`,
        'Aislamiento por aliado',
        'Válido hasta el ' + formatDate(invite.expiresAt),
      ]}
    >
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">
          Invitación de acceso
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#0A0A0A]">
          Activa tu cuenta
        </h1>
        <p className="mt-2 text-sm leading-6 text-black/50">
          Te invitó <strong className="font-medium text-[#0A0A0A]">{invite.partnerName}</strong>.
        </p>
      </div>

      <div className="mb-7 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#BCD86C]">
            <Mail className="size-4 text-[#0A0A0A]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#0A0A0A]">{invite.email}</p>
            <p className="text-xs text-black/45">
              Rol: {ROLE_LABELS[invite.role]} · Vence {formatDate(invite.expiresAt)}
            </p>
          </div>
        </div>
      </div>

      <form
        className="space-y-4"
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
              <Label htmlFor={field.name}>Tu nombre completo</Label>
              <Input
                id={field.name}
                name={field.name}
                autoComplete="name"
                placeholder="Nombre y apellido"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                className="h-11 rounded-xl border-black/15 bg-white px-3.5"
                required
              />
            </div>
          )}
        />

        <form.Field
          name="password"
          children={(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Contraseña</Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                className="h-11 rounded-xl border-black/15 bg-white px-3.5"
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
              <Label htmlFor={field.name}>Confirmar contraseña</Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                className="h-11 rounded-xl border-black/15 bg-white px-3.5"
                minLength={8}
                required
              />
            </div>
          )}
        />

        {error ? (
          <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-sm text-[#0A0A0A]">
            {error}
          </div>
        ) : null}

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="h-11 w-full rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Activando cuenta…
                </>
              ) : (
                <>
                  Crear mi acceso
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        />
      </form>
    </AuthShell>
  )
}
