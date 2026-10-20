import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type {
  DashboardSummary,
  InvitePreview,
  InviteRow,
  Paginated,
  Partner,
  Role,
  UserRow,
} from '@tools/shared'
import { apiFetch } from './api'

export type Me = {
  user: {
    id: string
    name: string
    email: string
    role: Role
    partnerId: string | null
    image: string | null
  }
  partner: {
    id: string
    name: string
    type: 'permanente' | 'bazar'
    currency: 'USD' | 'EUR' | 'VES'
    status: 'active' | 'inactive'
  } | null
}

export type PartnerOption = {
  id: string
  name: string
  type: 'permanente' | 'bazar'
  currency: 'USD' | 'EUR' | 'VES'
  contactPhone: string | null
}

export type UsersQuery = {
  search?: string
  partnerId?: string
  role?: Role
  status?: 'active' | 'suspended'
  page?: number
  pageSize?: number
}

export type InvitesQuery = {
  search?: string
  partnerId?: string
  status?: 'pending' | 'used' | 'expired' | 'revoked'
  page?: number
  pageSize?: number
}

export type PartnersQuery = {
  search?: string
  status?: 'active' | 'inactive'
  type?: 'permanente' | 'bazar'
  page?: number
  pageSize?: number
}

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => apiFetch<{ data: Me }>('/api/me').then((response) => response.data),
  staleTime: 0,
  retry: false,
})

export const setupStatusQuery = queryOptions({
  queryKey: ['setup-status'],
  queryFn: () =>
    apiFetch<{ needsSetup: boolean }>('/api/setup/status').then((response) => response.needsSetup),
  staleTime: 10_000,
  retry: false,
})

export const dashboardQuery = queryOptions({
  queryKey: ['dashboard'],
  queryFn: () =>
    apiFetch<{ data: DashboardSummary }>('/api/dashboard/summary').then(
      (response) => response.data,
    ),
})

export function partnersQuery(params: PartnersQuery = {}) {
  return queryOptions({
    queryKey: ['partners', params],
    queryFn: () =>
      apiFetch<Paginated<Partner>>(
        withQuery('/api/admin/partners', {
          search: params.search,
          status: params.status,
          type: params.type,
          page: params.page,
          pageSize: params.pageSize,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export const partnerOptionsQuery = queryOptions({
  queryKey: ['partner-options'],
  queryFn: () =>
    apiFetch<{ data: PartnerOption[] }>('/api/admin/partners/options').then(
      (response) => response.data,
    ),
  staleTime: 60_000,
})

export function usersQuery(params: UsersQuery = {}) {
  return queryOptions({
    queryKey: ['users', params],
    queryFn: () =>
      apiFetch<Paginated<UserRow>>(
        withQuery('/api/admin/users', {
          search: params.search,
          partnerId: params.partnerId,
          role: params.role,
          status: params.status,
          page: params.page,
          pageSize: params.pageSize,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function invitesQuery(params: InvitesQuery = {}) {
  return queryOptions({
    queryKey: ['invites', params],
    queryFn: () =>
      apiFetch<Paginated<InviteRow>>(
        withQuery('/api/admin/invites', {
          search: params.search,
          partnerId: params.partnerId,
          status: params.status,
          page: params.page,
          pageSize: params.pageSize,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function invitePreviewQuery(token: string) {
  return queryOptions({
    queryKey: ['invite-preview', token],
    queryFn: () =>
      apiFetch<{ data: InvitePreview }>(`/api/invites/${token}`).then((response) => response.data),
    staleTime: 10_000,
    retry: false,
  })
}
