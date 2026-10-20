import type { LucideIcon } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ComingSoon({
  title,
  description,
  icon: Icon,
  features,
}: {
  title: string
  description: string
  icon: LucideIcon
  features: string[]
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Módulo" title={title} description={description} />

      <Card className="overflow-hidden rounded-[28px] border-black/10 shadow-none">
        <CardContent className="grid gap-8 p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <div className="mb-5 flex size-14 items-center justify-center rounded-3xl bg-[#BCD86C]">
                <Icon className="size-6 text-[#0A0A0A]" />
              </div>
              <span className="inline-flex rounded-full bg-[#0A0A0A] px-3 py-1 text-[11px] font-medium text-white">
                En construcción
              </span>
              <h2 className="mt-5 max-w-md text-3xl font-semibold tracking-[-0.04em] text-[#0A0A0A]">
                Estamos preparando este módulo.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-black/55">
                La estructura de accesos y aliados ya está lista. Este espacio se activará en la
                siguiente fase, manteniendo la misma trazabilidad para Profit.
              </p>
            </div>

            <Button asChild variant="outline" className="w-fit rounded-xl">
              <Link to="/">
                <ArrowLeft className="size-4" />
                Volver al inicio
              </Link>
            </Button>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">
              Lo que incluirá
            </p>
            <ul className="mt-4 space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-black/65">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#BCD86C]" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
