import { createFileRoute } from '@tanstack/react-router'
import { Globe2 } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_app/tienda')({
  component: () => (
    <ComingSoon
      title="Tienda online"
      description="Conecta el catálogo de Eco Master con la experiencia de venta online."
      icon={Globe2}
      features={[
        'Catálogo público con productos disponibles',
        'Precios alineados al catálogo interno',
        'Pedidos con trazabilidad de origen',
        'Integración con inventario y ventas',
      ]}
    />
  ),
})
