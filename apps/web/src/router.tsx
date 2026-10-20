import { createRouter } from '@tanstack/react-router'
import { queryClient } from './lib/query-client'
import type { RouterContext } from './lib/router-context'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  context: { queryClient } satisfies RouterContext,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 15_000,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
