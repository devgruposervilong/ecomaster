import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { ArrowRight, Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { InstallAppPrompt } from '@/components/install-app-prompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth'
import { meQuery, setupStatusQuery } from '@/lib/queries'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (me) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function safeRedirect(value: string | undefined) {
  if (!value) return '/'

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { redirect: redirectTo } = Route.useSearch()
  const setup = useQuery(setupStatusQuery)
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError(null)

      const result = await authClient.signIn.email({
        email: value.email.trim(),
        password: value.password,
      })

      if (result.error) {
        setError(authErrorMessage(result.error, 'No pudimos iniciar sesión.'))
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['me'] })

      await navigate({ to: safeRedirect(redirectTo) })
    },
  })

  return (
    <>
      <AuthShell
        headline="Tu operación comercial, con trazabilidad desde el primer movimiento."
        description="Registra ventas, transferencias y stock de cada aliado. La información queda lista para conciliar y cargar en Profit."
        bullets={[
          'Acceso aislado por aliado',
          'Enlaces de invitación de un solo uso',
          'Base lista para ventas, inventario y finanzas',
        ]}
      >
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">
            Acceso al backoffice
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#0A0A0A]">
            Bienvenido de vuelta
          </h1>
          <p className="mt-2 text-sm leading-6 text-black/50">
            Ingresa con el correo y la contraseña que definiste al aceptar tu invitación.
          </p>
        </div>

        <form
          className="space-y-5"
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
                  autoComplete="email"
                  placeholder="tu@correo.com"
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
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 rounded-xl border-black/15 bg-white px-3.5"
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
                    Ingresando…
                  </>
                ) : (
                  <>
                    Entrar al backoffice
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            )}
          />
        </form>

        {setup.data ? (
          <p className="mt-6 text-sm text-black/45">
            ¿Es la primera vez?{' '}
            <Link to="/setup" className="font-medium text-[#0A0A0A] underline underline-offset-4">
              Configura el administrador
            </Link>
          </p>
        ) : null}

        <p className="mt-8 border-t border-black/10 pt-5 text-xs leading-5 text-black/35">
          Si no tienes acceso, pide al administrador de Eco Master que genere un enlace de
          invitación para tu aliado.
        </p>
      </AuthShell>
      <InstallAppPrompt />
    </>
  )
}
