import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function createDb(client: D1Database) {
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>

export * as schema from './schema'
