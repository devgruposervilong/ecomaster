import { createFileRoute } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_app/ventas')({
  component: () => (
    <ComingSoon
      title="Ventas"
      description="Registra las ventas de cada aliado con su moneda, tasa y método de pago."
      icon={ShoppingCart}
      features={[
        'Venta rápida para bazares y operación permanente',
        'Precios de venta y liquidación por aliado',
        'Cálculo de deuda en la moneda base del aliado',
        'Comprobantes y cierres listos para Profit',
      ]}
    />
  ),
})
