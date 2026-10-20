import { cn } from '@/lib/utils'

type Status =
  'active' | 'inactive' | 'suspended' | 'invited' | 'pending' | 'used' | 'expired' | 'revoked'

const styles: Record<Status, string> = {
  active: 'bg-[#BCD86C] text-[#0A0A0A]',
  used: 'bg-[#BCD86C] text-[#0A0A0A]',
  pending: 'bg-[#0A0A0A] text-white',
  invited: 'bg-[#0A0A0A] text-white',
  inactive: 'border border-black/10 bg-transparent text-black/55',
  suspended: 'border border-black/10 bg-transparent text-black/55',
  expired: 'border border-black/10 bg-transparent text-black/55',
  revoked: 'border border-black/10 bg-transparent text-black/55',
}

const labels: Record<Status, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  invited: 'Invitado',
  pending: 'Pendiente',
  used: 'Utilizada',
  expired: 'Vencida',
  revoked: 'Revocada',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
        styles[status],
        className,
      )}
    >
      {status === 'active' || status === 'used' ? (
        <span className="size-1.5 rounded-full bg-[#0A0A0A]" />
      ) : null}
      {labels[status]}
    </span>
  )
}
