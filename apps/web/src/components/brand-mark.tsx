import { cn } from '@/lib/utils'

export function BrandMark({
  variant = 'boxed',
  className,
}: {
  variant?: 'boxed' | 'plain'
  className?: string
}) {
  if (variant === 'plain') {
    return (
      <img
        src="/logo-eco-master-trimmed.png"
        alt="Eco Master"
        className={cn('h-9 w-auto max-w-[190px] object-contain', className)}
      />
    )
  }

  return (
    <div className={cn('flex w-fit items-center rounded-2xl bg-[#0A0A0A] px-3 py-2', className)}>
      <img
        src="/logo-eco-master-trimmed.png"
        alt="Eco Master"
        className="h-7 w-auto max-w-[150px] object-contain"
      />
    </div>
  )
}
