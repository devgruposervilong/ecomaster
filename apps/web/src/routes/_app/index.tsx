import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Clock3,
  Handshake,
  Mail,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SalesChart } from '@/components/sales-chart'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/lib/auth-context'
import { firstName, formatDateTime, formatNumber, partnerTypeLabel } from '@/lib/format'
import { dashboardQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
})

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  accent?: boolean
}) {
  return (
    <Card
      className={cn(
        'gap-0 rounded-[26px] border-black/10 py-0 shadow-none',
        accent ? 'bg-[#BCD86C]' : 'bg-white',
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className={cn('text-xs font-medium', accent ? 'text-black/60' : 'text-black/45')}>
            {label}
          </p>
          <div
            className={cn(
              'flex size-9 items-center justify-center rounded-2xl',
              accent ? 'bg-black/10' : 'bg-black/[0.04]',
            )}
          >
            <Icon className="size-4 text-[#0A0A0A]" />
          </div>
        </div>
        <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[#0A0A0A]">{value}</p>
        <p className={cn('mt-1 text-[11px]', accent ? 'text-black/55' : 'text-black/35')}>{hint}</p>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const me = useMe()
  const dashboard = useQuery(dashboardQuery)
  const isAdmin = me.user.role === 'admin'
  const data = dashboard.data
  const totalSales = data?.salesSeries.reduce((sum, point) => sum + point.value, 0) ?? 0
  const heroFacts = isAdmin
    ? [
        { label: 'Aislamiento', value: 'Por aliado' },
        { label: 'Acceso', value: 'Por invitación' },
        { label: 'Roles', value: '3 niveles' },
        { label: 'ERP', value: 'Profit-ready' },
      ]
    : [
        { label: 'Aliado', value: me.partner?.name ?? 'Sin asignar' },
        { label: 'Moneda', value: me.partner?.currency ?? '—' },
        { label: 'Acceso', value: 'Aislado' },
        { label: 'ERP', value: 'Profit-ready' },
      ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">
            {data?.todayLabel ?? 'Panel de operación'}
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.045em] text-[#0A0A0A] md:text-4xl">
            Hola, {firstName(me.user.name)}.
          </h1>
          <p className="mt-1.5 text-sm text-black/50">
            {isAdmin
              ? 'Este es el pulso de Eco Master y sus aliados comerciales.'
              : `Este es el pulso de ${me.partner?.name ?? 'tu aliado'}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled
            title="Disponible en la siguiente fase"
            className="rounded-xl border-black/10 bg-white"
          >
            <ShoppingCart className="size-4" />
            Nueva venta
          </Button>
          <Button asChild className="rounded-xl bg-[#0A0A0A] text-white hover:bg-black/85">
            <Link to={isAdmin ? '/admin/aliados' : '/ajustes'}>
              {isAdmin ? 'Gestionar aliados' : 'Mi perfil'}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[30px] bg-[#0A0A0A] px-6 py-7 text-white md:px-9 md:py-9">
        <div
          className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border-[38px] border-[#BCD86C]/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-10 top-16 size-48 rounded-full bg-[#BCD86C]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 right-24 h-24 w-24 rounded-full border border-white/10"
          aria-hidden
        />
        <div className="relative grid gap-7 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/65">
              <Sparkles className="size-3 text-[#BCD86C]" />
              {isAdmin ? 'Fase 1 · Accesos y aliados' : 'Backoffice de aliado'}
            </span>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.045em] md:text-[2.6rem]">
              {isAdmin
                ? 'Una base ordenada para vender, conciliar y crecer.'
                : 'Tu operación, con trazabilidad desde el primer movimiento.'}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
              {isAdmin
                ? 'Administra quién entra, a qué aliado pertenece y qué puede hacer. Los módulos de ventas, inventario y finanzas se conectarán sobre esta misma estructura.'
                : `Consulta la información de ${me.partner?.name ?? 'tu aliado'} y prepárate para registrar ventas, inventario y finanzas con la misma trazabilidad de Eco Master.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {heroFacts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-white/10 bg-[#0A0A0A]/45 p-3 backdrop-blur-sm"
              >
                <p className="text-white/40">{fact.label}</p>
                <p className="mt-1 truncate font-medium text-white" title={fact.value}>
                  {fact.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {dashboard.isError ? (
        <Card className="rounded-[26px] border-black/10 shadow-none">
          <CardContent className="p-6 text-sm text-black/55">
            No pudimos cargar el resumen. Recarga la página para intentar de nuevo.
          </CardContent>
        </Card>
      ) : dashboard.isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn(
                'h-[132px] rounded-[26px] bg-black/[0.05]',
                index === 4 && 'col-span-2 sm:col-span-1',
              )}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <MetricCard
            label="Ventas de hoy"
            value={formatNumber(data.metrics.salesToday)}
            hint="Aún sin registrar"
            icon={ShoppingCart}
          />
          <MetricCard
            label="Unidades hoy"
            value={formatNumber(data.metrics.unitsToday)}
            hint="Aún sin registrar"
            icon={Boxes}
          />
          <MetricCard
            label="Aliados activos"
            value={formatNumber(data.metrics.activePartners)}
            hint={isAdmin ? 'Con acceso habilitado' : 'Tu aliado'}
            icon={Handshake}
          />
          <MetricCard
            label="Usuarios activos"
            value={formatNumber(data.metrics.activeUsers)}
            hint="Con sesión habilitada"
            icon={Users}
          />
          <div className="col-span-2 sm:col-span-1">
            <MetricCard
              label="Invitaciones"
              value={formatNumber(data.metrics.pendingInvites)}
              hint="Pendientes de aceptar"
              icon={Mail}
              accent
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <Card className="overflow-hidden rounded-[28px] border-black/10 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pb-0 pt-5 md:px-6">
            <div>
              <CardTitle className="text-base font-semibold tracking-[-0.02em]">
                Ventas · últimos 7 días
              </CardTitle>
              <p className="mt-1 text-xs text-black/40">
                Cuando registres ventas, aquí verás la evolución diaria.
              </p>
            </div>
            <StatusBadge status={totalSales > 0 ? 'active' : 'inactive'} />
          </CardHeader>
          <CardContent className="relative px-3 pb-4 pt-2 md:px-5">
            {data ? <SalesChart data={data.salesSeries} /> : null}
            {totalSales === 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-10 top-16 flex items-center justify-center">
                <div className="rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-center shadow-[0_14px_40px_-24px_rgba(10,10,10,0.35)] backdrop-blur">
                  <p className="text-sm font-medium text-[#0A0A0A]">Aún no hay ventas</p>
                  <p className="mt-1 text-xs text-black/45">
                    El módulo de ventas se activa en la siguiente fase.
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[28px] border-black/10 shadow-none">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-base font-semibold tracking-[-0.02em]">
                Accesos rápidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-4">
              {isAdmin ? (
                <>
                  <QuickLink
                    to="/admin/aliados"
                    icon={Handshake}
                    title="Aliados"
                    description="Crea y administra los socios comerciales."
                  />
                  <QuickLink
                    to="/admin/usuarios"
                    icon={Users}
                    title="Usuarios"
                    description="Invita, suspende y asigna roles."
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-black/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/35">
                    Tu aliado
                  </p>
                  <p className="mt-2 text-base font-semibold text-[#0A0A0A]">
                    {me.partner?.name ?? 'Sin aliado asignado'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {me.partner ? (
                      <>
                        <StatusBadge status={me.partner.status} />
                        <span className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-black/50">
                          {partnerTypeLabel(me.partner.type)}
                        </span>
                        <span className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-black/50">
                          {me.partner.currency}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 w-full rounded-xl border-black/10"
                  >
                    <Link to="/ajustes">
                      Ver mi perfil
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-black/10 bg-[#BCD86C] shadow-none">
            <CardContent className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
                Siguiente fase
              </p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#0A0A0A]">
                Ventas, inventario y finanzas.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { icon: ShoppingCart, label: 'Ventas' },
                  { icon: Package, label: 'Inventario' },
                  { icon: Wallet, label: 'Finanzas' },
                  { icon: BarChart3, label: 'Reportes' },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/10 px-2.5 py-1 text-[11px] text-black/70"
                  >
                    <item.icon className="size-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 pb-2 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-[28px] border-black/10 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
            <CardTitle className="text-base font-semibold tracking-[-0.02em]">
              Actividad reciente
            </CardTitle>
            <Clock3 className="size-4 text-black/30" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {data && data.recentActivity.length > 0 ? (
              <div className="divide-y divide-black/[0.06]">
                {data.recentActivity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#BCD86C]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-5 text-[#0A0A0A]">{entry.description}</p>
                      <p className="mt-0.5 text-[11px] text-black/35">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center">
                <p className="text-sm font-medium text-[#0A0A0A]">Aún no hay actividad</p>
                <p className="mt-1 text-xs leading-5 text-black/45">
                  Las invitaciones, cambios de usuarios y aliados aparecerán aquí.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-black/10 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
            <CardTitle className="text-base font-semibold tracking-[-0.02em]">
              Módulos en construcción
            </CardTitle>
            <Boxes className="size-4 text-black/30" />
          </CardHeader>
          <CardContent className="grid gap-2 px-3 pb-4 sm:grid-cols-2">
            {[
              {
                icon: ShoppingCart,
                title: 'Ventas',
                description: 'Registro diario y cierres por aliado.',
              },
              {
                icon: Package,
                title: 'Catálogo',
                description: 'Productos, precios y moneda base.',
              },
              {
                icon: Boxes,
                title: 'Inventario',
                description: 'Stock actual y movimientos.',
              },
              {
                icon: Wallet,
                title: 'Finanzas',
                description: 'Transferencias, comprobantes y deuda.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-black/10 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <item.icon className="size-4 text-black/45" />
                  <span className="rounded-full bg-[#BCD86C] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-black/60">
                    En construcción
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-[#0A0A0A]">{item.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-black/40">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-black/[0.035]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#BCD86C]">
        <Icon className="size-4 text-[#0A0A0A]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#0A0A0A]">{title}</p>
        <p className="truncate text-[11px] text-black/40">{description}</p>
      </div>
      <ArrowUpRight className="size-4 text-black/25 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-black/60" />
    </Link>
  )
}
