import { useMemo } from 'react'
import { defineChart, lineY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import type { DashboardSummary } from '@tools/shared'

export function SalesChart({ data }: { data: DashboardSummary['salesSeries'] }) {
  const definition = useMemo(() => {
    const max = Math.max(10, ...data.map((point) => point.value))

    return defineChart({
      marks: [
        lineY(data, {
          x: 'label',
          y: 'value',
          points: true,
          stroke: '#0A0A0A',
          strokeWidth: 2,
        }),
      ],
      scales: {
        x: {
          scale: () => scalePoint<string>().padding(0.3),
        },
        y: {
          scale: scaleLinear().domain([0, max]),
          nice: true,
          grid: true,
          axis: {
            ticks: {
              format: (value) => `${value}`,
            },
          },
        },
      },
    })
  }, [data])

  return <Chart definition={definition} height={320} ariaLabel="Ventas de los últimos siete días" />
}
