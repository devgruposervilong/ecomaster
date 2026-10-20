import { createFileRoute } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_app/finanzas')({
  component: () => (
    <ComingSoon
      title="Finanzas"
      description="Concilia transferencias, comprobantes de pago y saldos pendientes."
      icon={Wallet}
      features={[
        'Transferencias creadas por Eco Master y confirmadas por el aliado',
        'Carga de comprobantes con imagen',
        'Cálculo de deuda según la tasa del día de pago',
        'Cierres y pagos aprobados manualmente',
      ]}
    />
  ),
})
