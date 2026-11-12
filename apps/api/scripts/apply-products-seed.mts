import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Aplica `fixtures/products-seed.sql` en la base local o remota.
 *
 * Uso:
 *   node scripts/apply-products-seed.mts --local
 *   node scripts/apply-products-seed.mts --remote
 *
 * El SQL es idempotente. En remoto se envía en lotes para no exceder el límite
 * de argumentos de Windows; el CLI `cf` ya está autenticado.
 */

const scriptDir = dirname(fileURLToPath(import.meta.url))
const apiDir = resolve(scriptDir, '..')
const seedPath = resolve(scriptDir, 'fixtures/products-seed.sql')
const databaseId = '0352d618-75f0-4803-9531-e27ce0fb0f59'
const databaseName = 'ecomaster-db'
const local = process.argv.includes('--local')
const remote = process.argv.includes('--remote')

if (local === remote) {
  console.error('Indica exactamente un modo: --local o --remote.')
  process.exit(1)
}

const sql = readFileSync(seedPath, 'utf8')
const statements = sql
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('--'))

if (statements.length === 0) {
  console.error('El archivo de seed no tiene sentencias SQL.')
  process.exit(1)
}

if (local) {
  const wranglerCli = resolve(apiDir, 'node_modules/wrangler/bin/wrangler.js')

  execFileSync(
    process.execPath,
    [
      wranglerCli,
      'd1',
      'execute',
      databaseName,
      '--local',
      '--persist-to',
      '.wrangler/state',
      '--config',
      'wrangler.d1.jsonc',
      '--file',
      'scripts/fixtures/products-seed.sql',
    ],
    { cwd: apiDir, stdio: 'inherit' },
  )

  console.log(`Seed aplicado en local: ${statements.length} sentencia(s).`)
  process.exit(0)
}

const cfCli = resolve(apiDir, 'node_modules/cf/bin/cf')
const MAX_CHUNK = 8_000
const chunks: string[] = []
let current = ''

for (const statement of statements) {
  if (current.length > 0 && current.length + statement.length + 1 > MAX_CHUNK) {
    chunks.push(current)
    current = ''
  }

  current += `${statement}\n`
}

if (current.length > 0) chunks.push(current)

for (const [index, chunk] of chunks.entries()) {
  const output = execFileSync(
    process.execPath,
    [cfCli, 'd1', 'query', databaseId, '--sql', chunk, '-q'],
    { cwd: apiDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )

  const parsed = JSON.parse(output.trim()) as Array<{
    success?: boolean
    results?: unknown
    errors?: unknown
  }>

  if (!Array.isArray(parsed) || parsed.some((result) => result.success !== true)) {
    console.error(`Lote ${index + 1}/${chunks.length} falló:`)
    console.error(output)
    process.exit(1)
  }

  console.log(`Lote ${index + 1}/${chunks.length} OK`)
}

console.log(`Seed aplicado en remoto: ${statements.length} sentencia(s).`)
