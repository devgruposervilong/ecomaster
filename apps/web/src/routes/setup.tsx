import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { meQuery, setupStatusQuery } from '@/lib/queries'

export const Route = createFileRoute('/setup')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (me) throw redirect({ to: '/' })
  },
  component: SetupPage,
})

function SetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const status = useQuery(setupStatusQuery)
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      token: '',
      name: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError(null)

      try {
        await apiFetch('/api/setup', {
          method: 'POST',
          body: jsonBody({
            token: value.token.trim(),
            name: value.name.trim(),
            email: value.email.trim(),
            password: value.password,
          }),
        })

        await queryClient.invalidateQueries({ queryKey: ['me'] })
        await queryClient.invalidateQueries({ queryKey: ['setup-status'] })
        await navigate({ to: '/' })
      } catch (submitError) {
        setError(errorMessage(submitError))
      }
    },
  })

  if (status.data === false) {
    return (
      <AuthShell
        headline="La configuración inicial ya está completa."
        description="Ya existe un administrador en este backoffice. Ingresa con tus credenciales para continuar."
        bullets={[
          'Acceso protegido',
          'Usuarios aislados por aliado',
          'Trazabilidad lista para Profit',
        ]}
      >
        <div className="rounded-3xl border border-black/10 bg-white p-7">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <ShieldCheck className="size-5 text-[#0A0A0A]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[#0A0A0A]">Todo listo</h1>
          <p className="mt-2 text-sm leading-6 text-black/50">
            El administrador inicial ya fue creado. Si eres tú, inicia sesión. Si no, pide acceso al
            equipo de Eco Master.
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

  return (
    <AuthShell
      headline="Configura el primer acceso de Eco Master."
      description="Este paso crea la cuenta administradora que podrá gestionar aliados, invitaciones y accesos. Solo se puede ejecutar una vez."
      bullets={[
        'Protegido con el token del servidor',
        'Administrador con acceso global',
        'Los aliados se crean después desde el panel',
      ]}
    >
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">
          Configuración inicial
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#0A0A0A]">
          Crea el administrador
        </h1>
        <p className="mt-2 text-sm leading-6 text-black/50">
          Usa el token configurado en el servidor como{' '}
          <code className="rounded bg-black/[0.04] px-1 py-0.5 text-[11px]">SETUP_TOKEN</code>.
        </p>
      </div>

      {status.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-11 w-full rounded-xl bg-black/[0.05]" />
          <Skeleton className="h-11 w-full rounded-xl bg-black/[0.05]" />
          <Skeleton className="h-11 w-full rounded-xl bg-black/[0.05]" />
          <Skeleton className="h-11 w-full rounded-xl bg-black/[0.05]" />
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.Field
            name="token"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Token de configuración</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  placeholder="Token definido en el servidor"
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
            name="name"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Nombre completo</Label>
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
            name="email"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Correo electrónico</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  placeholder="admin@ecomaster.com"
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
                    Creando acceso…
                  </>
                ) : (
                  <>
                    Crear administrador
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            )}
          />
        </form>
      )}

      <p className="mt-6 text-sm text-black/45">
        ¿Ya está configurado?{' '}
        <Link to="/login" className="font-medium text-[#0A0A0A] underline underline-offset-4">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  )
}
