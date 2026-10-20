export const CARACAS_TIMEZONE = 'America/Caracas'

export function toBusinessDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: CARACAS_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function lastNDates(days: number, from = new Date()) {
  const result: Array<{ date: string; label: string }> = []

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(from.getTime() - index * 24 * 60 * 60 * 1000)
    result.push({
      date: toBusinessDate(date),
      label: new Intl.DateTimeFormat('es-VE', {
        timeZone: CARACAS_TIMEZONE,
        weekday: 'short',
      }).format(date),
    })
  }

  return result
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
