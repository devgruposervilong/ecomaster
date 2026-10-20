import { createFileRoute } from '@tanstack/react-router'
import { Package } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_app/catalogo')({
  component: () => (
    <ComingSoon
      title="Catálogo"
      description="Organiza los productos, precios y moneda base de cada aliado."
      icon={Package}
      features={[
        'Catálogo independiente por aliado',
        'Precios en USD o EUR según el acuerdo',
        'Categorías y códigos para conciliar con Profit',
        'Historial de cambios de precios',
      ]}
    />
  ),
})
