export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function firstName(name: string) {
  return name.split(/\s+/).filter(Boolean)[0] ?? name
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function relativeTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const diff = date.getTime() - Date.now()
  const minutes = Math.round(diff / 60_000)
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return formatter.format(days, 'day')
  return formatDate(date)
}

export function partnerTypeLabel(type: 'permanente' | 'bazar') {
  return type === 'permanente' ? 'Permanente' : 'Bazar'
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(value)
}

export function currencySymbol(currency: 'USD' | 'EUR' | 'VES') {
  if (currency === 'EUR') return '€'
  if (currency === 'VES') return 'Bs.'
  return '$'
}
