import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Convierte `fixtures/products-import.csv` en SQL idempotente para D1.
 *
 * Headers del CSV (alineados con la base de datos):
 *   sku, barcode, name, categories, iva_enabled
 *
 * `categories` acepta varias categorías separadas por "|". La relación N:M se
 * guarda en `product_categories`.
 *
 * Uso:
 *   node scripts/import-products.mts           # valida y escribe el SQL
 *   node scripts/import-products.mts --check   # solo valida
 */

const scriptDir = dirname(fileURLToPath(import.meta.url))
const inputPath = resolve(scriptDir, 'fixtures/products-import.csv')
const outputPath = resolve(scriptDir, 'fixtures/products-seed.sql')
const checkOnly = process.argv.includes('--check')

const HEADERS = ['sku', 'barcode', 'name', 'categories', 'iva_enabled'] as const
const NOW = `cast(unixepoch('subsecond') * 1000 as integer)`

type ImportRow = {
  line: number
  sku: string
  barcode: string | null
  name: string
  categories: string[]
  ivaEnabled: boolean
}

function fail(message: string): never {
  throw new Error(message)
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((current) => current.some((value) => value.trim() !== ''))
}

function sqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function parseBoolean(value: string, line: number) {
  const normalized = value.trim().toLowerCase()

  if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) return true

  if (['false', '0', 'no'].includes(normalized)) return false

  fail(`Línea ${line}: iva_enabled debe ser true/false, recibí "${value}".`)
}

const rawRows = parseCsv(readFileSync(inputPath, 'utf8'))
const header = rawRows.shift()?.map((value) => value.trim())

if (!header) fail('El CSV está vacío.')

if (
  header.length !== HEADERS.length ||
  HEADERS.some((expected, index) => header[index] !== expected)
) {
  fail(`Headers inválidos. Esperado: ${HEADERS.join(', ')}. Recibido: ${header.join(', ')}.`)
}

const rows: ImportRow[] = []
const skus = new Map<string, number>()
const barcodes = new Map<string, number>()
const categoryNames = new Set<string>()

for (const [index, cells] of rawRows.entries()) {
  const line = index + 2

  if (cells.length !== HEADERS.length) {
    fail(`Línea ${line}: se esperaban ${HEADERS.length} columnas y llegaron ${cells.length}.`)
  }

  const rawSku = cells[0] ?? ''
  const rawBarcode = cells[1] ?? ''
  const rawName = cells[2] ?? ''
  const rawCategories = cells[3] ?? ''
  const rawIva = cells[4] ?? ''
  const sku = rawSku.trim()
  const name = rawName.trim()
  const barcodeValue = rawBarcode.trim()

  if (sku.length === 0) fail(`Línea ${line}: el SKU es obligatorio.`)
  if (sku.length > 60) fail(`Línea ${line}: el SKU supera 60 caracteres.`)
  if (name.length < 2) fail(`Línea ${line}: el nombre es obligatorio.`)
  if (name.length > 160) fail(`Línea ${line}: el nombre supera 160 caracteres.`)

  const previousSkuLine = skus.get(sku)
  if (previousSkuLine !== undefined) {
    fail(`Línea ${line}: SKU ${sku} repetido (también en la línea ${previousSkuLine}).`)
  }
  skus.set(sku, line)

  const barcode =
    barcodeValue.length === 0 || barcodeValue.toUpperCase() === 'NULL' ? null : barcodeValue

  if (barcode && barcode.length > 60) {
    fail(`Línea ${line}: el código de barras supera 60 caracteres.`)
  }

  if (barcode) {
    const previousBarcodeLine = barcodes.get(barcode)
    if (previousBarcodeLine !== undefined) {
      fail(
        `Línea ${line}: código de barras ${barcode} repetido (también en la línea ${previousBarcodeLine}).`,
      )
    }
    barcodes.set(barcode, line)
  }

  const categories = [
    ...new Set(
      rawCategories
        .split('|')
        .map((category) => category.trim())
        .filter(Boolean),
    ),
  ]

  for (const category of categories) {
    if (category.length > 80) {
      fail(`Línea ${line}: la categoría "${category}" supera 80 caracteres.`)
    }
    categoryNames.add(category)
  }

  rows.push({
    line,
    sku,
    barcode,
    name,
    categories,
    ivaEnabled: parseBoolean(rawIva, line),
  })
}

if (rows.length === 0) fail('El CSV no tiene productos.')

const sql: string[] = [
  '-- Generado por apps/api/scripts/import-products.mts.',
  '-- Carga masiva idempotente: se puede ejecutar más de una vez.',
  '-- No editar a mano; modifica fixtures/products-import.csv y regenera.',
  '',
]

for (const category of [...categoryNames].sort((left, right) => left.localeCompare(right))) {
  sql.push(
    `INSERT INTO categories (id, name, status, created_at, updated_at) VALUES (lower(hex(randomblob(12))), ${sqlText(category)}, 'active', ${NOW}, ${NOW}) ON CONFLICT(name) DO NOTHING;`,
  )
}

for (const row of rows) {
  const barcode = row.barcode === null ? 'NULL' : sqlText(row.barcode)

  sql.push(
    `INSERT INTO products (id, sku, barcode, name, type, iva_enabled, status, track_inventory, created_at, updated_at) VALUES (lower(hex(randomblob(12))), ${sqlText(row.sku)}, ${barcode}, ${sqlText(row.name)}, 'article', ${row.ivaEnabled ? 1 : 0}, 'active', 1, ${NOW}, ${NOW}) ON CONFLICT(sku) DO UPDATE SET barcode = excluded.barcode, name = excluded.name, iva_enabled = excluded.iva_enabled, updated_at = excluded.updated_at;`,
  )
}

for (const row of rows) {
  for (const [position, category] of row.categories.entries()) {
    sql.push(
      `INSERT INTO product_categories (id, product_id, category_id, position, created_at) SELECT lower(hex(randomblob(12))), p.id, c.id, ${position}, ${NOW} FROM products p JOIN categories c ON c.name = ${sqlText(category)} WHERE p.sku = ${sqlText(row.sku)} ON CONFLICT(product_id, category_id) DO NOTHING;`,
    )
  }
}

sql.push('')

const content = sql.join('\n')
const bom = rows.filter((row) => row.barcode === null).length
const withCategories = rows.filter((row) => row.categories.length > 0).length

console.log(`Productos: ${rows.length}`)
console.log(`Categorías: ${categoryNames.size}`)
console.log(`Sin código de barras: ${bom}`)
console.log(`Con al menos una categoría: ${withCategories}`)

if (checkOnly) {
  console.log('Validación OK. No se escribió el SQL (--check).')
} else {
  writeFileSync(outputPath, content, 'utf8')
  console.log(`SQL generado: ${outputPath}`)
}
