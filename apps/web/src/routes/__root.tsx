import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import type { RouterContext } from '@/lib/router-context'

function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-white px-6 text-center">
      <BrandMark />
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/35">
        Error 404
      </p>
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#0A0A0A]">
        No encontramos esta página.
      </h1>
      <p className="max-w-sm text-sm leading-6 text-black/50">
        El enlace puede haber cambiado o ya no existe. Vuelve al inicio para continuar.
      </p>
      <Button asChild className="mt-2 rounded-xl">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}

function RootComponent() {
  return (
    <TooltipProvider delayDuration={200}>
      <Outlet />
    </TooltipProvider>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})
