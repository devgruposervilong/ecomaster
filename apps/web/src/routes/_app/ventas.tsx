import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/ventas')({
  component: SalesLayout,
})

function SalesLayout() {
  return <Outlet />
}
