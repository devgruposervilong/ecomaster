import { useDeferredValue, useMemo, useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { Handshake, Pencil, Plus, Search } from 'lucide-react'
import type { Partner } from '@tools/shared'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { PartnerFormDialog } from '@/components/partners/partner-form-dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/lib/auth-context'
import { currencySymbol, initials, partnerTypeLabel } from '@/lib/format'
import { partnersQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/aliados')({
  component: PartnersPage,
})

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, Partner>()
const EMPTY_PARTNERS: Partner[] = []
const PAGE_SIZE = 10

function PartnersPage() {
  const me = useMe()
  if (me.user.role !== 'admin') return <Navigate to="/" replace />
  return <PartnersPageContent />
}

function columnClass(id: string) {
  return cn(
    (id === 'alias' || id === 'rif') && 'hidden lg:table-cell',
    (id === 'type' || id === 'currency' || id === 'userCount') && 'hidden xl:table-cell',
    id === 'actions' && 'text-right',
  )
}

function PartnersPageContent() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all')
  const [type, setType] = useState<'permanente' | 'bazar' | 'all'>('all')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)

  const partners = useQuery(
    partnersQuery({
      search: deferredSearch.trim() || undefined,
      status: status === 'all' ? undefined : status,
      type: type === 'all' ? undefined : type,
      page,
      pageSize: PAGE_SIZE,
    }),
  )

  const resetPage = () => setPage(1)
  const meta = partners.data?.meta

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: 'Nombre',
          cell: ({ row }) => {
            const partner = row.original
            return (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-[11px] font-semibold text-[#0A0A0A]">
                  {initials(partner.alias ?? partner.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#0A0A0A]">{partner.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-black/40 lg:hidden">
                    {partner.alias ?? 'Sin alias'} · {partner.rif ?? 'Sin RIF'}
                  </p>
                  <p className="mt-0.5 hidden truncate text-[11px] text-black/40 lg:block xl:hidden">
                    {partnerTypeLabel(partner.type)} · {partner.currency}
                  </p>
                </div>
              </div>
            )
          },
        }),
        helper.accessor('alias', {
          header: 'Alias',
          cell: ({ row }) => (
            <span
              className={cn('text-[12px]', row.original.alias ? 'text-black/60' : 'text-black/30')}
            >
              {row.original.alias ?? 'Sin alias'}
            </span>
          ),
        }),
        helper.accessor('rif', {
          header: 'RIF',
          cell: ({ row }) => (
            <span
              className={cn(
                'text-[12px] tabular-nums',
                row.original.rif ? 'text-black/60' : 'text-black/30',
              )}
            >
              {row.original.rif ?? 'Sin RIF'}
            </span>
          ),
        }),
        helper.accessor('type', {
          header: 'Tipo',
          cell: ({ row }) => (
            <span className="inline-flex rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-black/60">
              {partnerTypeLabel(row.original.type)}
            </span>
          ),
        }),
        helper.accessor('currency', {
          header: 'Moneda',
          cell: ({ row }) => (
            <span className="text-[12px] text-black/55">
              {currencySymbol(row.original.currency)}{' '}
              <span className="text-black/35">{row.original.currency}</span>
            </span>
          ),
        }),
        helper.accessor('userCount', {
          header: 'Usuarios',
          cell: ({ row }) => (
            <span className="text-[12px] text-black/55">{row.original.userCount}</span>
          ),
        }),
        helper.accessor('status', {
          header: 'Estado',
          cell: ({ row }) => <StatusBadge status={row.original.status} />,
        }),
        helper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
              className="h-8 rounded-lg border-black/10 px-2.5 text-xs"
              aria-label={`Editar ${row.original.name}`}
            >
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          ),
        }),
      ]),
    [],
  )

  const table = useTable({
    features,
    columns,
    data: partners.data?.data ?? EMPTY_PARTNERS,
  })

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración"
        title="Aliados"
        description="Cada aliado tiene su propio RIF, alias, moneda base, catálogo y usuarios aislados. Aquí defines la estructura comercial."
        actions={
          <Button
            onClick={openNew}
            className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
          >
            <Plus className="size-4" />
            Nuevo aliado
          </Button>
        }
      />

      <Card className="rounded-2xl border-black/10 shadow-none">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/30" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                resetPage()
              }}
              placeholder="Buscar por nombre, alias, RIF o contacto…"
              className="h-10 rounded-xl border-black/10 pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as typeof status)
                resetPage()
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-black/10 sm:w-[140px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={type}
              onValueChange={(value) => {
                setType(value as typeof type)
                resetPage()
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-black/10 sm:w-[170px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="permanente">Permanentes</SelectItem>
                <SelectItem value="bazar">Bazares</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden rounded-2xl border-black/10 py-0 shadow-none">
        {partners.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-xl bg-black/[0.05]" />
            ))}
          </div>
        ) : partners.isError ? (
          <div className="p-6 text-sm text-black/55">
            No pudimos cargar los aliados. Recarga la página para intentar de nuevo.
          </div>
        ) : partners.data && partners.data.data.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="Aún no hay aliados con estos filtros"
            description="Crea el primer aliado para poder invitarlo y asignarle usuarios."
            className="m-4 border-0 bg-black/[0.015]"
            action={
              <Button
                onClick={openNew}
                className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
              >
                <Plus className="size-4" />
                Crear aliado
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left xl:min-w-[920px]">
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id} className="border-b border-black/[0.07]">
                      {group.headers.map((header) => (
                        <th
                          key={header.id}
                          className={cn(
                            'px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 md:px-5',
                            columnClass(header.column.id),
                          )}
                        >
                          {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-black/[0.05] last:border-0 hover:bg-black/[0.015]"
                    >
                      {row.getAllCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-3 py-3.5 align-middle md:px-5',
                            columnClass(cell.column.id),
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta ? (
              <div className="flex flex-col gap-2 border-t border-black/[0.07] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-black/40">
                  Página {meta.page} de {meta.totalPages} · {meta.total} aliados
                </p>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="h-8 rounded-lg border-black/10"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="h-8 rounded-lg border-black/10"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <PartnerFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        partner={editing}
      />
    </div>
  )
}
