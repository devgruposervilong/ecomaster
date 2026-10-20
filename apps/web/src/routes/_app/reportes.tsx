import { createFileRoute } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_app/reportes')({
  component: () => (
    <ComingSoon
      title="Reportes"
      description="Consulta el desempeño de aliados, productos y cierres de operación."
      icon={BarChart3}
      features={[
        'Ventas por periodo y por aliado',
        'Productos más vendidos y rotación',
        'Deuda y transferencias pendientes',
        'Exportación CSV compatible con Profit',
      ]}
    />
  ),
})
