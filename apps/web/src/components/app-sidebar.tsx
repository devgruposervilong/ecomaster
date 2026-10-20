import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Boxes,
  Globe2,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { signOutAndReset } from '@/lib/auth'
import { firstName, initials } from '@/lib/format'
import type { Me } from '@/lib/queries'
import { ROLE_LABELS } from '@tools/shared'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  soon?: boolean
  adminOnly?: boolean
}

const operationNav: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart, soon: true },
  { to: '/catalogo', label: 'Catálogo', icon: Package, soon: true },
  { to: '/inventario', label: 'Inventario', icon: Boxes, soon: true },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, soon: true },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, soon: true },
]

const adminNav: NavItem[] = [
  { to: '/admin/aliados', label: 'Aliados', icon: Handshake, adminOnly: true },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  { to: '/tienda', label: 'Tienda online', icon: Globe2, soon: true },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium transition-colors',
        active
          ? 'bg-[#BCD86C] text-[#0A0A0A]'
          : 'text-black/58 hover:bg-black/[0.045] hover:text-[#0A0A0A]',
      )}
    >
      <Icon
        className={cn(
          'size-[18px] shrink-0',
          active ? 'text-[#0A0A0A]' : 'text-black/42 group-hover:text-[#0A0A0A]',
        )}
      />
      <span className="truncate">{item.label}</span>
      {item.soon ? (
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            active ? 'bg-black/10 text-black/60' : 'text-black/30',
          )}
        >
          Pronto
        </span>
      ) : null}
    </Link>
  )
}

function SidebarBody({
  me,
  pathname,
  onNavigate,
}: {
  me: Me
  pathname: string
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = me.user.role === 'admin'

  const handleSignOut = async () => {
    await signOutAndReset(queryClient)
    await navigate({ to: '/login', replace: true })
  }

  const renderSection = (items: NavItem[]) => (
    <div className="space-y-1">
      {items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const active =
            item.to === '/'
              ? pathname === '/'
              : pathname === item.to || pathname.startsWith(`${item.to}/`)
          return <NavLink key={item.to} item={item} active={active} onNavigate={onNavigate} />
        })}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="px-1 pt-1">
        <BrandMark />
        <p className="mt-3 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
          Backoffice de aliados
        </p>
      </div>

      <nav className="mt-8 flex-1 space-y-7 overflow-y-auto px-0.5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/30">
            Operación
          </p>
          {renderSection(operationNav)}
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/30">
            Administración
          </p>
          {renderSection(adminNav)}
        </div>
      </nav>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A] text-xs font-semibold text-white">
            {initials(me.user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-5 text-[#0A0A0A]">
              {firstName(me.user.name)}
            </p>
            <p className="truncate text-[11px] leading-4 text-black/45">
              {me.partner?.name ?? ROLE_LABELS[me.user.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex size-8 items-center justify-center rounded-xl text-black/40 transition-colors hover:bg-black/[0.05] hover:text-[#0A0A0A]"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar({ me }: { me: Me }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <aside className="fixed bottom-4 left-4 top-4 z-30 hidden w-[264px] overflow-hidden rounded-[30px] border border-black/10 bg-white shadow-[0_24px_70px_-30px_rgba(10,10,10,0.35)] md:flex">
      <SidebarBody me={me} pathname={pathname} />
    </aside>
  )
}

export function MobileNav({ me }: { me: Me }) {
  const [open, setOpen] = useState(false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl border-black/10 bg-white"
          aria-label="Abrir menú"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] border-black/10 bg-white p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Menú principal</SheetTitle>
        </SheetHeader>
        <SidebarBody me={me} pathname={pathname} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
