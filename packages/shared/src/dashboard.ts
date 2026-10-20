export type DashboardSummary = {
  todayLabel: string
  metrics: {
    salesToday: number
    unitsToday: number
    activePartners: number
    activeUsers: number
    pendingInvites: number
  }
  salesSeries: Array<{ date: string; label: string; value: number }>
  topProducts: Array<{ id: string; name: string; sales: number }>
  topPartners: Array<{ id: string; name: string; sales: number }>
  recentActivity: Array<{
    id: string
    action: string
    description: string
    createdAt: string
  }>
}
