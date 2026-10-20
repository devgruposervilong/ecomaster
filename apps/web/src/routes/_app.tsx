import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppSidebar, MobileNav } from '@/components/app-sidebar'
import { BrandMark } from '@/components/brand-mark'
import { AuthProvider } from '@/lib/auth-context'
import { initials } from '@/lib/format'
import { meQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch(() => null)

    if (!me) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }

    return { me }
  },
  component: AppLayout,
})

function AppLayout() {
  const { me } = Route.useRouteContext()

  return (
    <AuthProvider me={me}>
      <div className="min-h-svh bg-white">
        <AppSidebar me={me} />

        <div className="md:pl-[296px]">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
            <MobileNav me={me} />
            <BrandMark className="scale-[0.86]" />
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#0A0A0A] text-[11px] font-semibold text-white">
              {initials(me.user.name)}
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-5 md:px-8 md:pt-8">
            <Outlet />
          </main>
        </div>
      </div>
    </AuthProvider>
  )
}
