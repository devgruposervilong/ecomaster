import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-xl border border-black/15 bg-transparent px-3.5 py-3 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-black/35 focus-visible:border-[#BCD86C] focus-visible:ring-[3px] focus-visible:ring-[#BCD86C]/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
