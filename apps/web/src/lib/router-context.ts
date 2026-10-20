import type { QueryClient } from '@tanstack/react-query'
import type { Me } from './queries'

export type RouterContext = {
  queryClient: QueryClient
  me?: Me
}
