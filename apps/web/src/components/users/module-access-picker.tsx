import { Check } from 'lucide-react'
import {
  MODULE_DESCRIPTIONS,
  MODULE_KEYS,
  MODULE_LABELS,
  type ModuleKey,
} from '@ecomaster/shared'
import { cn } from '@/lib/utils'

export function ModuleAccessPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ModuleKey[]
  onChange: (modules: ModuleKey[]) => void
  disabled?: boolean
}) {
  const selected = new Set(value)

  function toggle(module: ModuleKey) {
    if (disabled) return
    const next = new Set(selected)
    if (next.has(module)) next.delete(module)
    else next.add(module)
    onChange([...next])
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MODULE_KEYS.map((module) => {
        const active = selected.has(module)
        return (
          <button
            key={module}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggle(module)}
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
              active
                ? 'border-[#BCD86C] bg-[#BCD86C]/25'
                : 'border-black/10 bg-white hover:bg-black/[0.025]',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                active
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                  : 'border-black/15 bg-white text-transparent',
              )}
            >
              <Check className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-[#0A0A0A]">
                {MODULE_LABELS[module]}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-black/45">
                {MODULE_DESCRIPTIONS[module]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
