import { useDeferredValue, useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, Handshake, Mail, Phone, Plus, Search, Users } from 'lucide-react'
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
import { currencySymbol, formatDate, partnerTypeLabel } from '@/lib/format'
import { partnersQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/admin/aliados')({
  component: PartnersPage,
})

function PartnersPage() {
  const me = useMe()
  if (me.user.role !== 'admin') return <Navigate to="/" replace />
  return <PartnersPageContent />
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
      pageSize: 12,
    }),
  )

  const resetPage = () => setPage(1)
  const meta = partners.data?.meta

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (partner: Partner) => {
    setEditing(partner)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración"
        title="Aliados"
        description="Cada aliado tiene su propia moneda base, catálogo y usuarios aislados. Aquí defines la estructura comercial."
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
              placeholder="Buscar por nombre, código o contacto…"
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

      {partners.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[220px] rounded-[24px] bg-black/[0.05]" />
          ))}
        </div>
      ) : partners.isError ? (
        <Card className="rounded-2xl border-black/10 shadow-none">
          <CardContent className="p-6 text-sm text-black/55">
            No pudimos cargar los aliados. Recarga la página para intentar de nuevo.
          </CardContent>
        </Card>
      ) : partners.data && partners.data.data.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Aún no hay aliados con estos filtros"
          description="Crea el primer aliado para poder invitarlo y asignarle usuarios."
          className="bg-black/[0.015]"
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {partners.data?.data.map((partner) => (
              <PartnerCard key={partner.id} partner={partner} onEdit={openEdit} />
            ))}
          </div>

          {meta ? (
            <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
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

function PartnerCard({
  partner,
  onEdit,
}: {
  partner: Partner
  onEdit: (partner: Partner) => void
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-[26px] border-black/10 py-0 shadow-none transition-shadow hover:shadow-[0_18px_50px_-30px_rgba(10,10,10,0.35)]">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0A0A0A] text-sm font-semibold text-white">
              {partner.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-[-0.02em] text-[#0A0A0A]">
                {partner.name}
              </p>
              <p className="mt-0.5 text-[11px] text-black/40">
                {partnerTypeLabel(partner.type)} · {partner.currency}
              </p>
            </div>
          </div>
          <StatusBadge status={partner.status} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-black/10 p-3">
            <div className="flex items-center gap-1.5 text-black/35">
              <Users className="size-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Usuarios</span>
            </div>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#0A0A0A]">
              {partner.userCount}
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 p-3">
            <div className="flex items-center gap-1.5 text-black/35">
              <Building2 className="size-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Moneda</span>
            </div>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#0A0A0A]">
              {currencySymbol(partner.currency)}
              <span className="ml-1 text-xs font-medium text-black/40">{partner.currency}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 text-[11px] text-black/45">
          {partner.contactName ? <p className="truncate">Contacto: {partner.contactName}</p> : null}
          {partner.contactPhone ? (
            <p className="flex items-center gap-1.5 truncate">
              <Phone className="size-3" />
              {partner.contactPhone}
            </p>
          ) : null}
          {partner.contactEmail ? (
            <p className="flex items-center gap-1.5 truncate">
              <Mail className="size-3" />
              {partner.contactEmail}
            </p>
          ) : null}
          {!partner.contactName && !partner.contactPhone && !partner.contactEmail ? (
            <p className="text-black/30">Sin datos de contacto</p>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-black/[0.07] pt-4">
          <p className="text-[10px] text-black/30">Desde {formatDate(partner.createdAt)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(partner)}
            className="h-8 rounded-lg border-black/10 text-xs"
          >
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
