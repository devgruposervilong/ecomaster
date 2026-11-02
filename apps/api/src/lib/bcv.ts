const BCV_URL = 'https://www.bcv.org.ve/'
const DEFAULT_TIMEOUT_MS = 15_000

const BROWSER_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'es-VE,es;q=0.9,en;q=0.8',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
} as const

export type BcvRateSource = 'bcv'

export type BcvRateSnapshot = {
  date: string
  usdRate: number
  eurRate: number
  rawUsd: string
  rawEur: string
  source: BcvRateSource
  scrapedAt: Date
}

export type BcvErrorCode =
  | 'BCV_TIMEOUT'
  | 'BCV_FETCH_FAILED'
  | 'BCV_HTTP_ERROR'
  | 'BCV_EMPTY_RESPONSE'
  | 'BCV_PARSE_ERROR'
  | 'BCV_INVALID_RATE'
  | 'BCV_INVALID_DATE'

export class BcvScrapeError extends Error {
  readonly code: BcvErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: BcvErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'BcvScrapeError'
    this.code = code
    this.details = details
  }
}

function decodeHtmlText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Convierte el texto publicado por el BCV a número sin perder la representación
 * original. El BCV usa coma decimal y, si la tasa supera los mil, punto para
 * los miles (por ejemplo `1.234,56789000`).
 */
export function parseBcvRate(value: string): number {
  const compact = value.replace(/\s+/g, '')
  if (!compact || !/^[0-9.,]+$/.test(compact)) {
    throw new BcvScrapeError(
      'BCV_INVALID_RATE',
      'La tasa publicada por el BCV no tiene un formato válido.',
      {
        value,
      },
    )
  }

  let normalized = compact

  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
  } else if (normalized.includes(',')) {
    const commaParts = normalized.split(',')
    normalized = commaParts.length > 2 ? normalized.replace(/,/g, '') : normalized.replace(',', '.')
  } else {
    const parts = normalized.split('.')
    if (parts.length > 2 || (parts.length === 2 && parts[1]?.length === 3)) {
      normalized = normalized.replace(/\./g, '')
    }
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BcvScrapeError(
      'BCV_INVALID_RATE',
      'La tasa publicada por el BCV no es un número positivo.',
      {
        value,
      },
    )
  }

  return parsed
}

export function parseBcvDate(value: string) {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)
  const date = match?.[1]

  if (!date) {
    throw new BcvScrapeError('BCV_INVALID_DATE', 'El BCV no publicó una fecha válida.', { value })
  }

  const parsed = new Date(`${date}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new BcvScrapeError('BCV_INVALID_DATE', 'El BCV no publicó una fecha válida.', { value })
  }

  return date
}

function extractRate(html: string, id: 'euro' | 'dolar') {
  const startPattern = new RegExp(`<div[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>`, 'i')
  const start = startPattern.exec(html)

  if (!start || start.index === undefined) {
    throw new BcvScrapeError(
      'BCV_PARSE_ERROR',
      `No encontramos el bloque de la tasa ${id} en la página del BCV.`,
    )
  }

  const rest = html.slice(start.index + start[0].length)
  const endPattern =
    /<div[^>]*\bid\s*=\s*["'](?:euro|yuan|lira|rublo|dolar)["']|<div[^>]*class\s*=\s*["'][^"']*\bpull-right\b/i
  const end = endPattern.exec(rest)
  const block = end?.index === undefined ? rest : rest.slice(0, end.index)

  const strong =
    /<strong[^>]*class\s*=\s*["'][^"']*\bstrong-tb\b[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i.exec(
      block,
    )

  if (!strong?.[1]) {
    throw new BcvScrapeError(
      'BCV_PARSE_ERROR',
      `No encontramos el valor de la tasa ${id} en la página del BCV.`,
    )
  }

  return decodeHtmlText(strong[1])
}

function extractDate(html: string) {
  const label = /Fecha\s+Valor\s*:/i.exec(html)

  if (!label || label.index === undefined) {
    throw new BcvScrapeError(
      'BCV_PARSE_ERROR',
      'No encontramos la fecha valor en la página del BCV.',
    )
  }

  const spanStart = html.indexOf('<span', label.index)
  const spanEnd = spanStart === -1 ? -1 : html.indexOf('>', spanStart)

  if (spanStart === -1 || spanEnd === -1) {
    throw new BcvScrapeError(
      'BCV_PARSE_ERROR',
      'No encontramos la fecha valor en la página del BCV.',
    )
  }

  const tag = html.slice(spanStart, spanEnd + 1)
  if (!/\bdate-display-single\b|\bdc:date\b/i.test(tag)) {
    throw new BcvScrapeError(
      'BCV_PARSE_ERROR',
      'La fecha valor del BCV no tiene el formato esperado.',
    )
  }

  const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
  if (!content) {
    throw new BcvScrapeError('BCV_PARSE_ERROR', 'La fecha valor del BCV no incluye su valor.')
  }

  return parseBcvDate(content)
}

export function parseBcvHtml(html: string): Omit<BcvRateSnapshot, 'scrapedAt'> {
  if (!html.trim()) {
    throw new BcvScrapeError('BCV_EMPTY_RESPONSE', 'El BCV devolvió una página vacía.')
  }

  const rawUsd = extractRate(html, 'dolar')
  const rawEur = extractRate(html, 'euro')

  return {
    date: extractDate(html),
    usdRate: parseBcvRate(rawUsd),
    eurRate: parseBcvRate(rawEur),
    rawUsd,
    rawEur,
    source: 'bcv',
  }
}

export async function fetchBcvSnapshot(
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const fetcher = options.fetcher ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const scrapedAt = new Date()

  let response: Response

  try {
    response = await fetcher(BCV_URL, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')

    throw new BcvScrapeError(
      isTimeout ? 'BCV_TIMEOUT' : 'BCV_FETCH_FAILED',
      isTimeout
        ? 'La consulta al BCV excedió el tiempo límite.'
        : 'No pudimos conectarnos con la página del BCV.',
      {
        cause: error instanceof Error ? error.message : String(error),
        timeoutMs,
      },
    )
  }

  let html: string

  try {
    html = await response.text()
  } catch (error) {
    throw new BcvScrapeError('BCV_FETCH_FAILED', 'No pudimos leer la respuesta del BCV.', {
      cause: error instanceof Error ? error.message : String(error),
    })
  }

  if (!response.ok) {
    throw new BcvScrapeError('BCV_HTTP_ERROR', 'El BCV respondió con un estado HTTP no exitoso.', {
      status: response.status,
      statusText: response.statusText,
    })
  }

  return {
    ...parseBcvHtml(html),
    scrapedAt,
  } satisfies BcvRateSnapshot
}
