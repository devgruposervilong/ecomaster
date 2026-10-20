import type { ReactNode } from 'react'
import { BrandMark } from '@/components/brand-mark'

export function AuthShell({
  headline,
  description,
  bullets,
  children,
}: {
  headline: string
  description: string
  bullets: string[]
  children: ReactNode
}) {
  return (
    <div className="grid min-h-svh bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0A0A0A] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          className="pointer-events-none absolute -right-28 top-16 size-[360px] rounded-full bg-[#BCD86C]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 size-[280px] rounded-full border border-white/10"
          aria-hidden
        />

        <div className="relative">
          <BrandMark variant="plain" className="h-10 max-w-[210px]" />
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
            Backoffice de aliados
          </p>
        </div>

        <div className="relative max-w-xl">
          <p className="mb-5 inline-flex rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/65">
            Eco Master · Operación comercial
          </p>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.045em] xl:text-5xl">
            {headline}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/55">{description}</p>

          <ul className="mt-8 space-y-3">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-3 text-sm text-white/75">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#BCD86C]">
                  <span className="size-1.5 rounded-full bg-[#0A0A0A]" />
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/35">
          Trazabilidad de ventas, inventario y finanzas para Profit.
        </p>
      </section>

      <section className="flex min-h-svh flex-col px-5 py-8 sm:px-8 lg:px-12">
        <div className="mb-10 lg:hidden">
          <BrandMark />
          <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-black/35">
            Backoffice de aliados
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <p className="mt-10 text-center text-[11px] text-black/35 lg:text-left">
          Eco Master · Backoffice de aliados comerciales
        </p>
      </section>
    </div>
  )
}
