import { useDeferredValue, useMemo, useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import {
  Ban,
  KeyRound,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  ROLE_LABELS,
  USER_STATUS_LABELS,
  isCollaboratorRole,
  isGlobalRole,
  type InviteRow,
  type Role,
  type UserRow,
} from '@ecomaster/shared'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { EditUserDialog } from '@/components/users/edit-user-dialog'
import { InviteLinkDialog } from '@/components/users/invite-link-dialog'
import { InviteUserDialog } from '@/components/users/invite-user-dialog'
import { PasswordDialog } from '@/components/users/password-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { useMe } from '@/lib/auth-context'
import { formatDate, formatDateTime, initials } from '@/lib/format'
import { invitesQuery, partnerOptionsQuery, usersQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/usuarios')({
  component: UsersPage,
})

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, UserRow>()
const EMPTY_USERS: UserRow[] = []
const PAGE_SIZE = 10

function UsersPage() {
  const me = useMe()
  if (me.user.role !== 'admin') return <Navigate to="/" replace />
  return <UsersPageContent />
}

function UsersPageContent() {
  const me = useMe()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('users')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [partnerId, setPartnerId] = useState('all')
  const [role, setRole] = useState<Role | 'all'>('all')
  const [status, setStatus] = useState<'active' | 'suspended' | 'all'>('all')
  const [page, setPage] = useState(1)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [createdInvite, setCreatedInvite] = useState<{
    invite: InviteRow
    url: string
  } | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<UserRow | null>(null)
  const [inviteRevokeTarget, setInviteRevokeTarget] = useState<InviteRow | null>(null)

  const partners = useQuery(partnerOptionsQuery)
  const users = useQuery(
    usersQuery({
      search: deferredSearch.trim() || undefined,
      partnerId: partnerId === 'all' ? undefined : partnerId,
      role: role === 'all' ? undefined : role,
      status: status === 'all' ? undefined : status,
      page,
      pageSize: PAGE_SIZE,
    }),
  )
  const invites = useQuery(invitesQuery({ status: 'pending', pageSize: 100 }))

  const statusMutation = useMutation({
    mutationFn: async (target: UserRow) => {
      if (target.banned) {
        return apiFetch(`/api/admin/users/${target.id}/unban`, { method: 'POST' })
      }
      return apiFetch(`/api/admin/users/${target.id}/ban`, {
        method: 'POST',
        body: jsonBody({ reason: '' }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Estado del usuario actualizado')
      setStatusTarget(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const revokeMutation = useMutation({
    mutationFn: (target: UserRow) =>
      apiFetch(`/api/admin/users/${target.id}/revoke-sessions`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Sesiones cerradas')
      setRevokeTarget(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (target: InviteRow) =>
      apiFetch(`/api/admin/invites/${target.id}/revoke`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invites'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Invitación revocada')
      setInviteRevokeTarget(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: 'Usuario',
          cell: ({ row }) => {
            const user = row.original
            return (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-[11px] font-semibold text-[#0A0A0A]">
                  {initials(user.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#0A0A0A]">{user.name}</p>
                  <p className="truncate text-[11px] text-black/40">{user.email}</p>
                  <p className="mt-0.5 truncate text-[11px] text-black/40 md:hidden">
                    {ROLE_LABELS[user.role]} · {user.partnerName ?? 'Acceso global'} ·{' '}
                    {USER_STATUS_LABELS[user.status]}
                  </p>
                </div>
              </div>
            )
          },
        }),
        helper.accessor('role', {
          header: 'Rol',
          cell: ({ row }) => (
            <div className="flex flex-col items-start gap-1">
              <span className="inline-flex rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-black/60">
                {ROLE_LABELS[row.original.role]}
              </span>
              {isCollaboratorRole(row.original.role) ? (
                <span className="text-[10px] text-black/35">
                  {row.original.modules.length} módulo
                  {row.original.modules.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          ),
        }),
        helper.accessor('partnerName', {
          header: 'Aliado',
          cell: ({ row }) => (
            <span className="text-[12px] text-black/55">
              {isGlobalRole(row.original.role)
                ? 'Acceso global'
                : (row.original.partnerName ?? 'Sin aliado')}
            </span>
          ),
        }),
        helper.accessor('status', {
          header: 'Estado',
          cell: ({ row }) => <StatusBadge status={row.original.status} />,
        }),
        helper.accessor('lastLoginAt', {
          header: 'Último acceso',
          cell: ({ row }) => (
            <span className="text-[12px] text-black/45">
              {row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : 'Nunca'}
            </span>
          ),
        }),
        helper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => {
            const user = row.original
            const isSelf = user.id === me.user.id
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-black/45 hover:bg-black/[0.05] hover:text-black"
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Acciones</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border-black/10">
                  <DropdownMenuLabel className="truncate text-[11px] font-normal text-black/40">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setEditingUser(user)}>
                    Editar acceso
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPasswordUser(user)} disabled={isSelf}>
                    <KeyRound className="size-4" />
                    Restablecer contraseña
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRevokeTarget(user)} disabled={isSelf}>
                    <RefreshCw className="size-4" />
                    Revocar sesiones
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setStatusTarget(user)}
                    disabled={isSelf}
                    className="text-[#0A0A0A] focus:bg-black/[0.05]"
                  >
                    <Ban className="size-4" />
                    {user.banned ? 'Reactivar usuario' : 'Suspender usuario'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          },
        }),
      ]),
    [me.user.id],
  )

  const table = useTable({
    features,
    columns,
    data: users.data?.data ?? EMPTY_USERS,
  })

  const resetPage = () => setPage(1)
  const meta = users.data?.meta
  const pendingInvites = invites.data?.data ?? []
  const pendingCount = invites.data?.meta.total ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Controla quién puede entrar, a qué aliado pertenece y qué rol tiene dentro del backoffice."
        actions={
          <Button
            onClick={() => setInviteOpen(true)}
            className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
          >
            <UserPlus className="size-4" />
            Invitar usuario
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-10 rounded-xl border border-black/10 bg-white p-1">
          <TabsTrigger value="users" className="rounded-lg px-3 text-xs">
            Usuarios
            {meta ? (
              <span className="ml-1.5 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-black/45">
                {meta.total}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="invitations" className="rounded-lg px-3 text-xs">
            Invitaciones
            {pendingCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-[#BCD86C] px-1.5 py-0.5 text-[10px] text-black/60">
                {pendingCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
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
                  placeholder="Buscar por nombre o correo…"
                  className="h-10 rounded-xl border-black/10 pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select
                  value={partnerId}
                  onValueChange={(value) => {
                    setPartnerId(value)
                    resetPage()
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-black/10 sm:w-[170px]">
                    <SelectValue placeholder="Aliado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los aliados</SelectItem>
                    {partners.data?.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={role}
                  onValueChange={(value) => {
                    setRole(value as Role | 'all')
                    resetPage()
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-black/10 sm:w-[150px]">
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="collaborator">Colaborador global</SelectItem>
                    <SelectItem value="partner_admin">Admin. del aliado</SelectItem>
                    <SelectItem value="partner_collaborator">Colaborador del aliado</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as typeof status)
                    resetPage()
                  }}
                >
                  <SelectTrigger className="col-span-2 h-10 w-full rounded-xl border-black/10 sm:col-span-1 sm:w-[140px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="suspended">Suspendidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-2xl border-black/10 py-0 shadow-none">
            {users.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-xl bg-black/[0.05]" />
                ))}
              </div>
            ) : users.isError ? (
              <div className="p-6 text-sm text-black/55">
                No pudimos cargar los usuarios. Recarga la página para intentar de nuevo.
              </div>
            ) : users.data && users.data.data.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No hay usuarios con estos filtros"
                description="Prueba con otro aliado o rol, o invita a una persona nueva."
                className="m-4 border-0 bg-black/[0.015]"
                action={
                  <Button
                    onClick={() => setInviteOpen(true)}
                    className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
                  >
                    <UserPlus className="size-4" />
                    Invitar usuario
                  </Button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left md:min-w-[820px]">
                    <thead>
                      {table.getHeaderGroups().map((group) => (
                        <tr key={group.id} className="border-b border-black/[0.07]">
                          {group.headers.map((header, index) => (
                            <th
                              key={header.id}
                              className={cn(
                                'px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 md:px-5',
                                index >= 1 && index <= 4 && 'hidden md:table-cell',
                                index === 5 && 'text-right',
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
                          {row.getAllCells().map((cell, index) => (
                            <td
                              key={cell.id}
                              className={cn(
                                'px-3 py-3.5 align-middle md:px-5',
                                index >= 1 && index <= 4 && 'hidden md:table-cell',
                                index === 5 && 'text-right',
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
                      Página {meta.page} de {meta.totalPages} · {meta.total} usuarios
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
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card className="gap-0 overflow-hidden rounded-2xl border-black/10 py-0 shadow-none">
            <div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4">
              <div>
                <p className="text-sm font-medium text-[#0A0A0A]">Invitaciones pendientes</p>
                <p className="mt-0.5 text-xs text-black/40">
                  Enlaces generados que aún no han sido aceptados.
                </p>
              </div>
              <span className="rounded-full bg-[#BCD86C] px-2.5 py-1 text-[11px] font-medium text-black/60">
                {pendingCount} pendientes
              </span>
            </div>

            {invites.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-xl bg-black/[0.05]" />
                ))}
              </div>
            ) : invites.isError ? (
              <div className="p-6 text-sm text-black/55">No pudimos cargar las invitaciones.</div>
            ) : pendingInvites.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No hay invitaciones pendientes"
                description="Cuando generes un enlace, aparecerá aquí hasta que la persona active su cuenta."
                className="m-4 border-0 bg-black/[0.015]"
                action={
                  <Button
                    onClick={() => setInviteOpen(true)}
                    className="rounded-xl bg-[#BCD86C] text-[#0A0A0A] hover:bg-[#BCD86C]/85"
                  >
                    <UserPlus className="size-4" />
                    Invitar usuario
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left md:min-w-[760px]">
                  <thead>
                    <tr className="border-b border-black/[0.07]">
                      {['Correo', 'Aliado', 'Rol', 'Creada', 'Vence', ''].map((heading, index) => (
                        <th
                          key={heading || 'actions'}
                          className={cn(
                            'px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 md:px-5',
                            index >= 1 && index <= 4 && 'hidden md:table-cell',
                            index === 5 && 'text-right',
                          )}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((invite) => (
                      <tr
                        key={invite.id}
                        className="border-b border-black/[0.05] last:border-0 hover:bg-black/[0.015]"
                      >
                        <td className="px-3 py-3.5 md:px-5">
                          <p className="text-[13px] font-medium text-[#0A0A0A]">{invite.email}</p>
                          <p className="text-[11px] text-black/35 md:hidden">
                            {invite.partnerName ?? 'Acceso global'} · {ROLE_LABELS[invite.role]} ·
                            vence {formatDate(invite.expiresAt)}
                          </p>
                          <p className="hidden text-[11px] text-black/35 md:block">
                            {invite.createdByName
                              ? `Por ${invite.createdByName}`
                              : 'Invitación del sistema'}
                          </p>
                        </td>
                        <td className="hidden px-5 py-3.5 text-[12px] text-black/55 md:table-cell">
                          {invite.partnerName ?? 'Acceso global'}
                        </td>
                        <td className="hidden px-5 py-3.5 md:table-cell">
                          <span className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-black/55">
                            {ROLE_LABELS[invite.role]}
                          </span>
                        </td>
                        <td className="hidden px-5 py-3.5 text-[12px] text-black/45 md:table-cell">
                          {formatDate(invite.createdAt)}
                        </td>
                        <td className="hidden px-5 py-3.5 md:table-cell">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-black/45">
                              {formatDate(invite.expiresAt)}
                            </span>
                            <StatusBadge status={invite.status} />
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right md:px-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInviteRevokeTarget(invite)}
                            className="h-8 rounded-lg text-black/50 hover:bg-black/[0.05] hover:text-black"
                          >
                            Revocar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={(payload) => {
          setCreatedInvite(payload)
          setLinkOpen(true)
        }}
      />

      <InviteLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        invite={createdInvite?.invite ?? null}
        url={createdInvite?.url ?? ''}
      />

      {editingUser ? (
        <EditUserDialog
          user={editingUser}
          open={Boolean(editingUser)}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null)
          }}
        />
      ) : null}

      {passwordUser ? (
        <PasswordDialog
          user={passwordUser}
          open={Boolean(passwordUser)}
          onOpenChange={(open) => {
            if (!open) setPasswordUser(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null)
        }}
        title={statusTarget?.banned ? 'Reactivar usuario' : 'Suspender usuario'}
        description={
          statusTarget?.banned
            ? `¿Quieres reactivar a ${statusTarget?.name}? Podrá iniciar sesión de nuevo.`
            : `¿Quieres suspender a ${statusTarget?.name}? Se cerrarán sus sesiones y no podrá entrar hasta que lo reactives.`
        }
        confirmLabel={statusTarget?.banned ? 'Reactivar' : 'Suspender'}
        destructive={!statusTarget?.banned}
        isPending={statusMutation.isPending}
        onConfirm={() => {
          if (statusTarget) statusMutation.mutate(statusTarget)
        }}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        title="Revocar sesiones"
        description={`Se cerrarán todas las sesiones activas de ${revokeTarget?.name ?? 'este usuario'}. Deberá iniciar sesión de nuevo.`}
        confirmLabel="Revocar sesiones"
        destructive
        isPending={revokeMutation.isPending}
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget)
        }}
      />

      <ConfirmDialog
        open={Boolean(inviteRevokeTarget)}
        onOpenChange={(open) => {
          if (!open) setInviteRevokeTarget(null)
        }}
        title="Revocar invitación"
        description={`El enlace de ${inviteRevokeTarget?.email ?? 'esta persona'} dejará de funcionar inmediatamente.`}
        confirmLabel="Revocar enlace"
        destructive
        isPending={revokeInviteMutation.isPending}
        onConfirm={() => {
          if (inviteRevokeTarget) revokeInviteMutation.mutate(inviteRevokeTarget)
        }}
      />
    </div>
  )
}
