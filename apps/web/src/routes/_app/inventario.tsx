import { createFileRoute } from '@tanstack/react-router'
import { Boxes } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_app/inventario')({
  component: () => (
    <ComingSoon
      title="Inventario"
      description="Controla el stock actual y los movimientos de mercancía por aliado."
      icon={Boxes}
      features={[
        'Stock actual por producto y aliado',
        'Entradas, salidas y ajustes trazables',
        'Conteo rápido para cierres de bazar',
        'Alertas de diferencias y productos agotados',
      ]}
    />
  ),
})
