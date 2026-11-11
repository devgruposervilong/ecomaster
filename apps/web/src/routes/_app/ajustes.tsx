import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogOut, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { ROLE_LABELS, isGlobalRole } from '@ecomaster/shared'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import { PageHeader } from '@/components/page-header'
import { PwaInstallCard } from '@/components/pwa-install-card'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { signOutAndReset } from '@/lib/auth'
import { useMe } from '@/lib/auth-context'
import { initials, partnerTypeLabel } from '@/lib/format'

export const Route = createFileRoute('/_app/ajustes')({
  component: SettingsPage,
})

function SettingsPage() {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const isAdmin = me.user.role === 'admin'
  const isGlobal = isGlobalRole(me.user.role)

  const handleSignOut = async () => {
    await signOutAndReset(queryClient)
    await navigate({ to: '/login', replace: true })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cuenta"
        title="Ajustes"
        description="Tu perfil, seguridad y preferencias de acceso al backoffice."
        actions={
          <Button variant="outline" onClick={handleSignOut} className="rounded-xl border-black/10">
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[28px] border-black/10 shadow-none">
          <CardHeader className="px-5 pt-5 md:px-6">
            <CardTitle className="text-base font-semibold tracking-[-0.02em]">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-6 md:px-6">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-[22px] bg-[#0A0A0A] text-lg font-semibold text-white">
                {initials(me.user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold tracking-[-0.03em] text-[#0A0A0A]">
                  {me.user.name}
                </p>
                <p className="truncate text-sm text-black/45">{me.user.email}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/10 p-4">
                <div className="flex items-center gap-2 text-black/35">
                  <UserRound className="size-3.5" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Rol</p>
                </div>
                <p className="mt-2 text-sm font-medium text-[#0A0A0A]">
                  {ROLE_LABELS[me.user.role]}
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                  Alcance
                </p>
                <p className="mt-2 text-sm font-medium text-[#0A0A0A]">
                  {isGlobal ? 'Todos los aliados' : 'Solo tu aliado'}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-black/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Aliado
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#0A0A0A]">
                    {me.partner?.name ?? 'Eco Master · acceso global'}
                  </p>
                  {me.partner ? (
                    <p className="mt-1 text-xs text-black/40">
                      {partnerTypeLabel(me.partner.type)} · {me.partner.currency}
                    </p>
                  ) : null}
                </div>
                {me.partner ? <StatusBadge status={me.partner.status} /> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[28px] border-black/10 shadow-none">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-base font-semibold tracking-[-0.02em]">
                Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-4">
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-black/[0.035]"
              >
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
                  <KeyRound className="size-4 text-[#0A0A0A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0A0A0A]">Contraseña</p>
                  <p className="text-[11px] text-black/40">
                    Cambia tu contraseña y cierra otras sesiones.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-black/[0.035]"
              >
                <div className="flex size-10 items-center justify-center rounded-2xl bg-black/[0.05]">
                  <LogOut className="size-4 text-[#0A0A0A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0A0A0A]">Cerrar sesión</p>
                  <p className="text-[11px] text-black/40">
                    Sal de este dispositivo y limpia los datos locales de sesión.
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>

          <PwaInstallCard />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-black/10 shadow-none">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#BCD86C]">
              <ShieldCheck className="size-4 text-[#0A0A0A]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0A0A0A]">
                {isAdmin
                  ? 'Acceso global'
                  : isGlobal
                    ? 'Acceso global por módulos'
                    : 'Acceso aislado por aliado'}
              </p>
              <p className="mt-1 text-xs leading-5 text-black/45">
                {isAdmin
                  ? 'Como administrador puedes gestionar todos los aliados, usuarios e invitaciones. Cada acción queda registrada en la actividad del backoffice.'
                  : isGlobal
                    ? 'Puedes consultar la operación de todos los aliados en los módulos habilitados por el administrador. No puedes gestionar aliados ni usuarios.'
                    : 'Tu usuario solo puede ver la información de tu aliado. Las ventas, el inventario y las finanzas se incorporarán respetando este aislamiento.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-black/10 shadow-none">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-black">
              <Sparkles className="size-4 text-[#BCD86C]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0A0A0A]">Eco Master Backoffice</p>
              <p className="mt-1 text-xs leading-5 text-black/45">
                Fase 1 · Accesos, aliados y usuarios. Versión 0.1.0. La aplicación se actualiza
                automáticamente cuando hay una versión nueva disponible.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  )
}
