import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = fileURLToPath(new URL('../src/', import.meta.url))

/**
 * Solo estos módulos pueden tocar el cliente D1 o Drizzle directamente:
 * auth (Better Auth), el factory del wrapper, salud y jobs programados.
 * Todo lo demás debe usar c.get('db'), que ya viene scopeado.
 */
const allowlists = {
  'createDb(': new Set(['db/index.ts', 'auth/auth.ts', 'app.ts']),
  'drizzle(': new Set(['db/index.ts', 'db/tenancy/scoped-db.ts']),
  'env.DB': new Set(['auth/auth.ts', 'auth/tenant.ts', 'app.ts', 'jobs/exchange-rate.ts']),
}

const forbidden = [
  { pattern: /\bcreateDb\s*\(/g, label: 'createDb(' },
  { pattern: /\bdrizzle\s*\(/g, label: 'drizzle(' },
  { pattern: /\b(?:c\.)?env\.DB\b/g, label: 'env.DB' },
]

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const violations = []

for (const file of walk(srcDir)) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue

  const relativePath = relative(srcDir, file).replaceAll('\\', '/')
  const content = readFileSync(file, 'utf8')

  for (const { pattern, label } of forbidden) {
    pattern.lastIndex = 0

    for (const match of content.matchAll(pattern)) {
      if (allowlists[label]?.has(relativePath)) continue
      if (relativePath.startsWith('jobs/')) continue

      const line = content.slice(0, match.index).split('\n').length
      violations.push(`${relativePath}:${line} usa ${label}; debe usar c.get('db') (scoped).`)
    }
  }
}

if (violations.length > 0) {
  console.error('[tenancy] Accesos directos a la base de datos fuera del wrapper:')
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log('[tenancy] OK: solo los módulos permitidos tocan D1/Drizzle directamente.')
