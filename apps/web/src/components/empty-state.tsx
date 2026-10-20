import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-black/15 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#BCD86C]">
        <Icon className="size-5 text-[#0A0A0A]" />
      </div>
      <p className="text-base font-medium text-[#0A0A0A]">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-black/50">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
