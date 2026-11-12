import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type {
  CatalogProduct,
  Category,
  Currency,
  DashboardSummary,
  InvitePreview,
  InviteRow,
  Paginated,
  Partner,
  PriceHistoryEntry,
  Channel,
  ChannelPrice,
  Product,
  ProductComponent,
  ModuleKey,
  ProductStatus,
  ProductType,
  Role,
  Sale,
  SaleDetail,
  UserRow,
} from '@ecomaster/shared'
import { apiFetch } from './api'

export type Me = {
  user: {
    id: string
    name: string
    email: string
    role: Role
    partnerId: string | null
    modules: ModuleKey[]
    image: string | null
  }
  partner: {
    id: string
    name: string
    type: 'permanente' | 'bazar'
    currency: Currency
    channelId: string
    status: 'active' | 'inactive'
  } | null
}

export type PartnerOption = {
  id: string
  name: string
  type: 'permanente' | 'bazar'
  currency: Currency
  channelId: string
  channelName: string
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

export type ProductsQuery = {
  search?: string
  channelId?: string
  categoryId?: string
  status?: ProductStatus
  type?: ProductType
  page?: number
  pageSize?: number
}

export type CategoriesQuery = {
  search?: string
  status?: 'active' | 'inactive'
  page?: number
  pageSize?: number
}

export type ChannelsQuery = {
  search?: string
  status?: 'active' | 'inactive'
  currency?: Currency
  page?: number
  pageSize?: number
}

export type ChannelPricesQuery = {
  search?: string
  status?: 'active' | 'inactive'
}

export type SalesQuery = {
  search?: string
  partnerId?: string
  status?: 'confirmed' | 'cancelled'
  paymentStatus?: 'unpaid' | 'partial' | 'paid'
  from?: string
  to?: string
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

export function productsQuery(params: ProductsQuery = {}) {
  return queryOptions({
    queryKey: ['products', params],
    queryFn: () =>
      apiFetch<Paginated<CatalogProduct>>(
        withQuery('/api/catalog/products', {
          search: params.search,
          channelId: params.channelId,
          categoryId: params.categoryId,
          status: params.status,
          type: params.type,
          page: params.page,
          pageSize: params.pageSize,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function categoriesQuery(params: CategoriesQuery = {}) {
  return queryOptions({
    queryKey: ['categories', params],
    queryFn: () =>
      apiFetch<Paginated<Category>>(
        withQuery('/api/catalog/categories', {
          search: params.search,
          status: params.status,
          page: params.page,
          pageSize: params.pageSize,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export const categoryOptionsQuery = queryOptions({
  queryKey: ['category-options'],
  queryFn: () =>
    apiFetch<{ data: Array<Pick<Category, 'id' | 'name' | 'status'>> }>(
      '/api/catalog/categories/options',
    ).then((response) => response.data),
  staleTime: 60_000,
})

export function channelsQuery(params: ChannelsQuery = {}) {
  return queryOptions({
    queryKey: ['channels', params],
    queryFn: () =>
      apiFetch<Paginated<Channel>>(
        withQuery('/api/catalog/channels', {
          search: params.search,
          status: params.status,
          currency: params.currency,
          page: params.page,
          pageSize: params.pageSize,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function channelOptionsQuery(
  currency?: Currency,
  status?: 'active' | 'inactive',
) {
  return queryOptions({
    queryKey: ['channel-options', currency ?? null, status ?? null],
    queryFn: () =>
      apiFetch<{ data: Array<Pick<Channel, 'id' | 'name' | 'currency' | 'status'>> }>(
        withQuery('/api/catalog/channels/options', { currency, status }),
      ).then((response) => response.data),
    staleTime: 30_000,
  })
}

export function channelPricesQuery(channelId: string, params: ChannelPricesQuery = {}) {
  return queryOptions({
    queryKey: ['channel-prices', channelId, params],
    queryFn: () =>
      apiFetch<{ data: ChannelPrice[] }>(
        withQuery(`/api/catalog/channels/${channelId}/prices`, {
          search: params.search,
          status: params.status,
        }),
      ).then((response) => response.data),
    staleTime: 10_000,
  })
}

export function productHistoryQuery(productId: string, channelId: string) {
  return queryOptions({
    queryKey: ['product-history', productId, channelId],
    queryFn: () =>
      apiFetch<{ data: PriceHistoryEntry[] }>(
        withQuery(`/api/catalog/products/${productId}/history`, { channelId }),
      ).then((response) => response.data),
  })
}

export function productComponentsQuery(productId: string) {
  return queryOptions({
    queryKey: ['product-components', productId],
    queryFn: () =>
      apiFetch<{ data: ProductComponent[] }>(
        `/api/catalog/products/${productId}/components`,
      ).then((response) => response.data),
  })
}

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

export function salesQuery(params: SalesQuery = {}) {
  return queryOptions({
    queryKey: ['sales', params],
    queryFn: () =>
      apiFetch<Paginated<Sale>>(
        withQuery('/api/sales', {
          search: params.search,
          partnerId: params.partnerId,
          status: params.status,
          paymentStatus: params.paymentStatus,
          from: params.from,
          to: params.to,
          page: params.page,
          pageSize: params.pageSize,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export type SalesPartnerOption = {
  id: string
  name: string
  type: 'permanente' | 'bazar'
  currency: Currency
  channelId: string
  channelName: string
  contactPhone: string | null
}

export const salesPartnerOptionsQuery = queryOptions({
  queryKey: ['sales-partner-options'],
  queryFn: () =>
    apiFetch<{ data: SalesPartnerOption[] }>('/api/sales/partners').then(
      (response) => response.data,
    ),
  staleTime: 60_000,
})

export type SalesRate = {
  date: string
  usdRate: number
  eurRate: number | null
  source: 'bcv'
}

export const salesRateQuery = queryOptions({
  queryKey: ['sales-rate'],
  queryFn: () =>
    apiFetch<{ data: SalesRate }>('/api/sales/rates').then((response) => response.data),
  staleTime: 60_000,
})

export function saleQuery(id: string) {
  return queryOptions({
    queryKey: ['sale', id],
    queryFn: () => apiFetch<{ data: SaleDetail }>(`/api/sales/${id}`).then((response) => response.data),
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

// Reexportado para evitar imports profundos en componentes.
export type { Product }
