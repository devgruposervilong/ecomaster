import { desc, eq } from 'drizzle-orm'
import { createDb } from '../db'
import { exchangeRates } from '../db/schema'
import type { AppEnv } from '../env'
import { BcvScrapeError, fetchBcvSnapshot, type BcvRateSnapshot } from '../lib/bcv'
import { toBusinessDate } from '../lib/dates'

export type ExchangeRateSyncResult =
  | {
      status: 'skipped'
      reason: 'future-rate-already-stored'
      date: string
    }
  | {
      status: 'synced'
      date: string
      usdRate: number
      eurRate: number
      rawUsd: string
      rawEur: string
      scrapedAt: string
    }

export type ExchangeRateSyncErrorCode =
  'BCV_DATE_REGRESSION' | 'BCV_NOT_PUBLISHED' | 'DB_READ_FAILED' | 'DB_WRITE_FAILED'

export class ExchangeRateSyncError extends Error {
  readonly code: ExchangeRateSyncErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ExchangeRateSyncErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ExchangeRateSyncError'
    this.code = code
    this.details = details
  }
}

const ATTEMPT_BY_CRON: Record<string, number> = {
  '30 1 * * *': 1,
  '0 2 * * *': 2,
  '30 3 * * *': 3,
}

type ExchangeRateEnv = Pick<AppEnv['Bindings'], 'DB'>

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function latestStoredDate(db: ReturnType<typeof createDb>) {
  try {
    const [latest] = await db
      .select({ date: exchangeRates.date })
      .from(exchangeRates)
      .where(eq(exchangeRates.source, 'bcv'))
      .orderBy(desc(exchangeRates.date))
      .limit(1)

    return latest?.date ?? null
  } catch (error) {
    throw new ExchangeRateSyncError(
      'DB_READ_FAILED',
      'No pudimos consultar la última tasa guardada.',
      { cause: errorMessage(error) },
    )
  }
}

async function saveSnapshot(db: ReturnType<typeof createDb>, snapshot: BcvRateSnapshot) {
  try {
    const [saved] = await db
      .insert(exchangeRates)
      .values({
        date: snapshot.date,
        usdRate: snapshot.usdRate,
        eurRate: snapshot.eurRate,
        source: snapshot.source,
        rawUsd: snapshot.rawUsd,
        rawEur: snapshot.rawEur,
        scrapedAt: snapshot.scrapedAt,
      })
      .onConflictDoUpdate({
        target: [exchangeRates.source, exchangeRates.date],
        set: {
          usdRate: snapshot.usdRate,
          eurRate: snapshot.eurRate,
          rawUsd: snapshot.rawUsd,
          rawEur: snapshot.rawEur,
          scrapedAt: snapshot.scrapedAt,
          updatedAt: new Date(),
        },
      })
      .returning({ id: exchangeRates.id, date: exchangeRates.date })

    if (!saved) {
      throw new Error('D1 no devolvió la fila guardada.')
    }

    return saved
  } catch (error) {
    throw new ExchangeRateSyncError(
      'DB_WRITE_FAILED',
      'No pudimos guardar la tasa del BCV en la base de datos.',
      { cause: errorMessage(error), date: snapshot.date },
    )
  }
}

/**
 * Reglas de éxito:
 * - Si ya existe una tasa con fecha posterior al día de hoy (Caracas), no se
 *   vuelve a consultar el BCV. Esto hace que los reintentos de las 10:00 pm y
 *   11:30 pm sean no-ops cuando el primer intento ya funcionó.
 * - La página debe publicar una fecha estrictamente posterior a hoy. El BCV
 *   publica la tasa del próximo día hábil, por lo que una fecha de hoy indica
 *   que la nueva tasa todavía no está disponible y el intento debe reintentarse.
 * - Aunque la fecha todavía no sea la próxima, si es más nueva que la última
 *   guardada se persiste para no perder el dato. El intento igual se marca como
 *   fallido para que los siguientes reintentos busquen la fecha próxima.
 */
export async function syncExchangeRate(
  env: ExchangeRateEnv,
  options: { now?: Date; fetcher?: typeof fetch } = {},
): Promise<ExchangeRateSyncResult> {
  const db = createDb(env.DB)
  const today = toBusinessDate(options.now ?? new Date())
  const latestDate = await latestStoredDate(db)

  if (latestDate && latestDate > today) {
    return {
      status: 'skipped',
      reason: 'future-rate-already-stored',
      date: latestDate,
    }
  }

  const snapshot = await fetchBcvSnapshot({ fetcher: options.fetcher })

  if (latestDate && snapshot.date < latestDate) {
    throw new ExchangeRateSyncError(
      'BCV_DATE_REGRESSION',
      'La fecha publicada por el BCV es anterior a la última tasa guardada.',
      { pageDate: snapshot.date, latestDate },
    )
  }

  await saveSnapshot(db, snapshot)

  if (snapshot.date <= today) {
    throw new ExchangeRateSyncError(
      'BCV_NOT_PUBLISHED',
      `El BCV todavía no publicó la tasa para un día posterior a ${today}.`,
      {
        pageDate: snapshot.date,
        today,
        usdRate: snapshot.usdRate,
        eurRate: snapshot.eurRate,
      },
    )
  }

  return {
    status: 'synced',
    date: snapshot.date,
    usdRate: snapshot.usdRate,
    eurRate: snapshot.eurRate,
    rawUsd: snapshot.rawUsd,
    rawEur: snapshot.rawEur,
    scrapedAt: snapshot.scrapedAt.toISOString(),
  }
}

export async function runScheduledExchangeRateSync(
  controller: ScheduledController,
  env: ExchangeRateEnv,
) {
  const startedAt = Date.now()
  const attempt = ATTEMPT_BY_CRON[controller.cron] ?? null
  const scheduledAt = new Date(controller.scheduledTime)

  try {
    const result = await syncExchangeRate(env, { now: scheduledAt })

    console.log(
      JSON.stringify({
        event: 'exchange_rate.sync',
        outcome: result.status,
        attempt,
        cron: controller.cron,
        scheduledAt: scheduledAt.toISOString(),
        durationMs: Date.now() - startedAt,
        result,
      }),
    )

    return result
  } catch (error) {
    const isKnownError = error instanceof ExchangeRateSyncError || error instanceof BcvScrapeError

    console.error(
      JSON.stringify({
        event: 'exchange_rate.sync_failed',
        attempt,
        cron: controller.cron,
        scheduledAt: scheduledAt.toISOString(),
        durationMs: Date.now() - startedAt,
        code: isKnownError ? error.code : 'UNEXPECTED_ERROR',
        message: errorMessage(error),
        details: isKnownError ? error.details : undefined,
      }),
    )

    throw error
  }
}
