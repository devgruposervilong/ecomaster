import { useDeferredValue, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  FolderTree,
  History,
  Info,
  ListPlus,
  Lock,
  Package,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Category, Channel, Product } from '@ecomaster/shared'
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPES,
} from '@ecomaster/shared'
import { CategoryFormDialog } from '@/components/catalog/category-form-dialog'
import { ChannelFormDialog } from '@/components/catalog/channel-form-dialog'
import { ProductChannelPrices } from '@/components/catalog/channel-price-editor'
import { ProductComponentsDialog } from '@/components/catalog/product-components-dialog'
import { ProductFormDialog } from '@/components/catalog/product-form-dialog'
import { ProductHistoryDialog } from '@/components/catalog/product-history-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch, errorMessage } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { channelsQuery, categoriesQuery, categoryOptionsQuery, meQuery, productsQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/catalogo')({
  component: CatalogPage,
})

const PAGE_SIZE = 20

function CatalogPage() {
  const queryClient = useQueryClient()
  const me = useQuery(meQuery)
  const isAdmin = me.data?.user.role === 'admin'
  const isGlobal = me.data?.user.role === 'admin' || me.data?.user.role === 'collaborator'
  const partnerChannelId = me.data?.partner?.channelId ?? ''

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [type, setType] = useState<'all' | 'article' | 'service' | 'promotion'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [tab, setTab] = useState<'products' | 'channels' | 'categories'>('products')
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [channelFormOpen, setChannelFormOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [deleteChannel, setDeleteChannel] = useState<Channel | null>(null)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null)
  const [historyTarget, setHistoryTarget] = useState<{
    product: Product
    channelId: string
  } | null>(null)
  const [componentsProduct, setComponentsProduct] = useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)

  const channels = useQuery(channelsQuery({ pageSize: 100 }))
  const categories = useQuery(categoriesQuery({ pageSize: 100 }))
  const categoryOptions = useQuery(categoryOptionsQuery)

  const allChannels = useMemo(() => channels.data?.data ?? [], [channels.data])
  const activeChannels = useMemo(
    () => allChannels.filter((channel) => channel.status === 'active'),
    [allChannels],
  )
  const partnerChannel = useMemo(
    () => allChannels.find((channel) => channel.id === partnerChannelId),
    [allChannels, partnerChannelId],
  )
  const currencies = useMemo(
    () => [...new Set(activeChannels.map((channel) => channel.currency))],
    [activeChannels],
  )

  const products = useQuery(
    productsQuery({
      search: deferredSearch.trim() || undefined,
      status: isAdmin && status !== 'all' ? status : undefined,
      type: type === 'all' ? undefined : type,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      page,
      pageSize: PAGE_SIZE,
    }),
  )

  const remove = useMutation({
    mutationFn: (product: Product) =>
      apiFetch(`/api/catalog/products/${product.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['channel-prices'] })
      toast.success('Producto eliminado')
      setDeleteProduct(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const removeCategory = useMutation({
    mutationFn: (category: Category) =>
      apiFetch(`/api/catalog/categories/${category.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['category-options'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Categoría eliminada')
      setDeleteCategory(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const removeChannel = useMutation({
    mutationFn: (channel: Channel) =>
      apiFetch(`/api/catalog/channels/${channel.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['channels'] })
      await queryClient.invalidateQueries({ queryKey: ['channel-options'] })
      await queryClient.invalidateQueries({ queryKey: ['partner-options'] })
      await queryClient.invalidateQueries({ queryKey: ['sales-partner-options'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['channel-prices'] })
      await queryClient.invalidateQueries({ queryKey: ['product-history'] })
      toast.success('Canal eliminado')
      setDeleteChannel(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const rows = products.data?.data ?? []
  const meta = products.data?.meta

  function openCreate() {
    setEditingProduct(null)
    setFormOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setFormOpen(true)
  }

  function openCreateChannel() {
    setEditingChannel(null)
    setChannelFormOpen(true)
  }

  function openEditChannel(channel: Channel) {
    setEditingChannel(channel)
    setChannelFormOpen(true)
  }

  function openCreateCategory() {
    setEditingCategory(null)
    setCategoryFormOpen(true)
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category)
    setCategoryFormOpen(true)
  }

  function openHistory(product: Product, channelId?: string) {
    const targetChannel = channelId ?? activeChannels[0]?.id ?? allChannels[0]?.id
    if (!targetChannel) {
      toast.error('Crea un canal de precios para consultar el historial.')
      return
    }
    setHistoryTarget({ product, channelId: targetChannel })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catálogo"
        title={
          tab === 'products'
            ? 'Productos y precios'
            : tab === 'channels'
              ? 'Canales de precios'
              : 'Categorías'
        }
        description={
          tab === 'products'
            ? isGlobal
              ? 'El producto es global. El precio se define por canal; cada aliado vende con el precio activo de su canal.'
              : 'Estos son los productos activos en tu canal de precios. Los precios los administra Ecomaster.'
            : tab === 'channels'
              ? isAdmin
                ? 'Crea y administra los canales que agrupan precios por moneda. Los aliados se asignan a un canal.'
                : 'Consulta los canales de precios de tu operación.'
              : isAdmin
                ? 'Crea y administra las categorías globales del catálogo. Un producto puede pertenecer a varias categorías.'
                : 'Consulta las categorías que organizan el catálogo global.'
        }
        actions={
          isAdmin ? (
            tab === 'products' ? (
              <Button
                type="button"
                onClick={openCreate}
                className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
              >
                <Plus className="size-4" />
                Nuevo producto
              </Button>
            ) : tab === 'channels' ? (
              <Button
                type="button"
                onClick={openCreateChannel}
                className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
              >
                <ListPlus className="size-4" />
                Nuevo canal
              </Button>
            ) : (
              <Button
                type="button"
                onClick={openCreateCategory}
                className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
              >
                <FolderTree className="size-4" />
                Nueva categoría
              </Button>
            )
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Package}
          label="Productos"
          value={meta?.total ?? 0}
          hint={isGlobal ? 'En el catálogo global' : 'En tu canal de precios'}
        />
        <SummaryCard
          icon={Tags}
          label="Canales de precios"
          value={channels.data?.meta.total ?? 0}
          hint={isGlobal ? 'Globales, compartibles' : (partnerChannel?.name ?? 'Tu canal')}
        />
        <SummaryCard
          icon={Info}
          label="Monedas"
          value={
            isGlobal
              ? currencies.length > 0
                ? currencies.join(' · ')
                : '—'
              : (me.data?.partner?.currency ?? '—')
          }
          hint={isGlobal ? 'Según los canales activos' : 'Según tu acuerdo'}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'products' | 'channels' | 'categories')}
        className="space-y-4"
      >
        <TabsList className="h-10 rounded-xl border border-black/10 bg-white p-1">
          <TabsTrigger value="products" className="rounded-lg px-3 text-xs">
            Productos
            {meta ? (
              <span className="ml-1.5 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-black/45">
                {meta.total}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="channels" className="rounded-lg px-3 text-xs">
            Canales
            {channels.data?.meta ? (
              <span className="ml-1.5 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-black/45">
                {channels.data.meta.total}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="categories" className="rounded-lg px-3 text-xs">
            Categorías
            {categories.data?.meta ? (
              <span className="ml-1.5 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-black/45">
                {categories.data.meta.total}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/35" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar por nombre, SKU o código de barras…"
            className="h-10 rounded-xl border-black/15 pl-10"
          />
        </div>

        {isAdmin ? (
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as typeof status)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-black/15 sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={type}
          onValueChange={(value) => {
            setType(value as typeof type)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-10 w-full rounded-xl border-black/15 sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {PRODUCT_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {PRODUCT_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categoryOptions.data && categoryOptions.data.length > 0 ? (
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-black/15 sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categoryOptions.data.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {isAdmin && activeChannels.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Todavía no hay canales de precios activos. Crea uno en la pestaña Canales antes de
            asignar aliados.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTab('channels')}
            className="rounded-lg border-amber-300 bg-white/60 text-amber-900 hover:bg-white"
          >
            Ir a Canales
          </Button>
        </div>
      ) : null}

      {!isGlobal && !partnerChannelId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tu aliado todavía no tiene un canal de precios asignado. Pide a Ecomaster que lo
          configure.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
        {products.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-black/[0.04]" />
            ))}
          </div>
        ) : products.isError ? (
          <div className="px-5 py-10 text-center text-sm text-black/55">
            No pudimos cargar el catálogo. Intenta de nuevo.
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No hay productos para mostrar"
            description={
              isAdmin
                ? 'Crea un producto y luego define su precio en cada canal.'
                : isGlobal
                  ? 'No hay productos activos en el catálogo global.'
                  : 'Tu canal todavía no tiene productos activos.'
            }
            action={
              isAdmin ? (
                <Button
                  type="button"
                  onClick={openCreate}
                  className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
                >
                  <Plus className="size-4" />
                  Nuevo producto
                </Button>
              ) : undefined
            }
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead className="bg-black/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Categorías
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    IVA
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    {isGlobal ? 'Precios por canal' : 'Precio'}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
                  <tr key={product.id} className="border-t border-black/[0.06] hover:bg-black/[0.015]">
                    <td className="w-[260px] px-4 py-3 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                          {product.type === 'promotion' ? (
                            <Boxes className="size-4 text-black/45" />
                          ) : (
                            <Package className="size-4 text-black/45" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#0A0A0A]">
                            {product.name}
                          </p>
                          <p className="truncate text-[11px] text-black/40">
                            {product.sku}
                            {product.barcode ? ` · ${product.barcode}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-[12px] text-black/60">
                      {PRODUCT_TYPE_LABELS[product.type]}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {product.categories.length === 0 ? (
                        <span className="text-[11px] text-black/30">Sin categoría</span>
                      ) : (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {product.categories.map((category) => (
                            <span
                              key={category.id}
                              className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-black/55"
                            >
                              {category.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-black/60">
                        {product.ivaEnabled ? '16%' : 'Exento'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isGlobal ? (
                        <ProductChannelPrices
                          product={product}
                          readOnly={!isAdmin}
                          onHistory={(channelId) => openHistory(product, channelId)}
                        />
                      ) : product.price === null ? (
                        <span className="text-[12px] text-black/35">
                          Sin precio · se cobra a mano
                        </span>
                      ) : (
                        <div>
                          <p className="text-[13px] font-semibold tabular-nums text-[#0A0A0A]">
                            {formatAmount(
                              product.price,
                              me.data?.partner?.currency ?? 'USD',
                            )}
                          </p>
                          {product.priceStatus === 'inactive' ? (
                            <p className="text-[10px] text-amber-700">Precio inactivo</p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-lg text-black/45 hover:text-[#0A0A0A]"
                          onClick={() => openHistory(product)}
                          disabled={allChannels.length === 0}
                          title="Historial de precios"
                        >
                          <History className="size-4" />
                        </Button>
                        {isAdmin ? (
                          <>
                            {product.type === 'promotion' ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-lg text-black/45 hover:text-[#0A0A0A]"
                                onClick={() => setComponentsProduct(product)}
                                title="Componentes"
                              >
                                <Boxes className="size-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-lg text-black/45 hover:text-[#0A0A0A]"
                              onClick={() => openEdit(product)}
                              title="Editar producto"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-lg text-black/45 hover:text-red-600"
                              onClick={() => setDeleteProduct(product)}
                              title="Eliminar producto"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Lock className="size-3.5 text-black/20" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3">
            <p className="text-xs text-black/45">
              Página {meta.page} de {meta.totalPages} · {meta.total} producto(s)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg border-black/10"
                disabled={meta.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg border-black/10"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-5 text-black/40">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Los precios se guardan en la base con punto decimal. En la interfaz se muestran con coma y
        miles según la configuración de Venezuela. Si un canal no tiene precio activo para un
        producto, solo un administrador puede cobrarlo a mano en la venta.
      </p>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
            {channels.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl bg-black/[0.04]" />
                ))}
              </div>
            ) : channels.isError ? (
              <div className="px-5 py-10 text-center text-sm text-black/55">
                No pudimos cargar los canales. Intenta de nuevo.
              </div>
            ) : allChannels.length === 0 ? (
              <EmptyState
                icon={Tags}
                title="Todavía no hay canales"
                description={
                  isAdmin
                    ? 'Crea el primer canal de precios para asignarle aliados y definir sus precios.'
                    : 'No hay canales de precios configurados.'
                }
                action={
                  isAdmin ? (
                    <Button
                      type="button"
                      onClick={openCreateChannel}
                      className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
                    >
                      <ListPlus className="size-4" />
                      Nuevo canal
                    </Button>
                  ) : undefined
                }
                className="border-0"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-black/[0.02]">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Canal
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Moneda
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Precios
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allChannels.map((channel) => (
                      <tr
                        key={channel.id}
                        className="border-t border-black/[0.06] hover:bg-black/[0.015]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                              <Tags className="size-4 text-black/45" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-[#0A0A0A]">
                                {channel.name}
                              </p>
                              <p className="truncate text-[11px] text-black/40">
                                {channel.description || 'Sin descripción'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-black/60">
                            {channel.currency}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={channel.status} />
                        </td>
                        <td className="px-4 py-3 text-[13px] tabular-nums text-black/60">
                          {channel.itemCount}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="rounded-lg text-black/45 hover:text-[#0A0A0A]"
                                  onClick={() => openEditChannel(channel)}
                                  title="Editar canal"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="rounded-lg text-black/45 hover:text-red-600"
                                  onClick={() => setDeleteChannel(channel)}
                                  title="Eliminar canal"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <Lock className="size-3.5 text-black/20" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-5 text-black/40">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Los canales con aliados o ventas asociadas no se pueden eliminar; desactívalos en su
            lugar. Al eliminar un canal sin uso también se eliminan sus precios e historial.
          </p>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
            {categories.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl bg-black/[0.04]" />
                ))}
              </div>
            ) : categories.isError ? (
              <div className="px-5 py-10 text-center text-sm text-black/55">
                No pudimos cargar las categorías. Intenta de nuevo.
              </div>
            ) : (categories.data?.data.length ?? 0) === 0 ? (
              <EmptyState
                icon={FolderTree}
                title="Todavía no hay categorías"
                description={
                  isAdmin
                    ? 'Crea la primera categoría para organizar los productos del catálogo global.'
                    : 'No hay categorías configuradas.'
                }
                action={
                  isAdmin ? (
                    <Button
                      type="button"
                      onClick={openCreateCategory}
                      className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
                    >
                      <FolderTree className="size-4" />
                      Nueva categoría
                    </Button>
                  ) : undefined
                }
                className="border-0"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-black/[0.02]">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Descripción
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Productos
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(categories.data?.data ?? []).map((category) => (
                      <tr
                        key={category.id}
                        className="border-t border-black/[0.06] hover:bg-black/[0.015]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                              <FolderTree className="size-4 text-black/45" />
                            </div>
                            <p className="truncate text-[13px] font-medium text-[#0A0A0A]">
                              {category.name}
                            </p>
                          </div>
                        </td>
                        <td className="max-w-[320px] px-4 py-3 text-[12px] text-black/55">
                          <p className="truncate">{category.description || 'Sin descripción'}</p>
                        </td>
                        <td className="px-4 py-3 text-[13px] tabular-nums text-black/60">
                          {category.productCount}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={category.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="rounded-lg text-black/45 hover:text-[#0A0A0A]"
                                  onClick={() => openEditCategory(category)}
                                  title="Editar categoría"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="rounded-lg text-black/45 hover:text-red-600"
                                  onClick={() => setDeleteCategory(category)}
                                  title="Eliminar categoría"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <Lock className="size-3.5 text-black/20" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-5 text-black/40">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Las categorías con productos asociados no se pueden eliminar; desactívalas en su lugar.
            Un producto puede pertenecer a varias categorías a la vez.
          </p>
        </TabsContent>
      </Tabs>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
      />
      <ChannelFormDialog
        open={channelFormOpen}
        onOpenChange={(next) => {
          setChannelFormOpen(next)
          if (!next) setEditingChannel(null)
        }}
        channel={editingChannel ?? undefined}
      />
      <CategoryFormDialog
        open={categoryFormOpen}
        onOpenChange={(next) => {
          setCategoryFormOpen(next)
          if (!next) setEditingCategory(null)
        }}
        category={editingCategory}
      />
      <ProductHistoryDialog
        open={Boolean(historyTarget)}
        onOpenChange={(next) => {
          if (!next) setHistoryTarget(null)
        }}
        product={historyTarget?.product ?? null}
        channels={allChannels}
        initialChannelId={historyTarget?.channelId}
      />
      <ProductComponentsDialog
        open={Boolean(componentsProduct)}
        onOpenChange={(next) => {
          if (!next) setComponentsProduct(null)
        }}
        product={componentsProduct}
      />
      <ConfirmDialog
        open={Boolean(deleteProduct)}
        onOpenChange={(next) => {
          if (!next) setDeleteProduct(null)
        }}
        title="Eliminar producto"
        description={
          deleteProduct
            ? `Se eliminará ${deleteProduct.name} del catálogo global. Esta acción no se puede deshacer si no tiene ventas asociadas.`
            : ''
        }
        confirmLabel="Eliminar"
        destructive
        isPending={remove.isPending}
        onConfirm={() => {
          if (deleteProduct) remove.mutate(deleteProduct)
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteChannel)}
        onOpenChange={(next) => {
          if (!next) setDeleteChannel(null)
        }}
        title="Eliminar canal"
        description={
          deleteChannel
            ? `Se eliminará el canal ${deleteChannel.name} junto con sus precios e historial. Si tiene aliados o ventas asociadas, no se podrá eliminar; en ese caso desactívalo.`
            : ''
        }
        confirmLabel="Eliminar"
        destructive
        isPending={removeChannel.isPending}
        onConfirm={() => {
          if (deleteChannel) removeChannel.mutate(deleteChannel)
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteCategory)}
        onOpenChange={(next) => {
          if (!next) setDeleteCategory(null)
        }}
        title="Eliminar categoría"
        description={
          deleteCategory
            ? `Se eliminará la categoría ${deleteCategory.name}. Si tiene productos asociados, no se podrá eliminar; en ese caso desactívala.`
            : ''
        }
        confirmLabel="Eliminar"
        destructive
        isPending={removeCategory.isPending}
        onConfirm={() => {
          if (deleteCategory) removeCategory.mutate(deleteCategory)
        }}
      />
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Package
  label: string
  value: string | number
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/35">
          {label}
        </p>
        <Icon className="size-4 text-black/30" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#0A0A0A]">{value}</p>
      <p className="mt-1 truncate text-[11px] text-black/40">{hint}</p>
    </div>
  )
}
