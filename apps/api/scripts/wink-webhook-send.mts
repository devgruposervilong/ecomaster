/**
 * Envía un webhook firmado a la API, simulando a Wink.
 *
 * Uso:
 *   $env:WINK_WEBHOOK_SECRET = "el-secreto"
 *   node apps/api/scripts/wink-webhook-send.mts
 *
 * Variables opcionales:
 *   WINK_WEBHOOK_URL      URL destino (por defecto http://127.0.0.1:8787/api/webhooks/wink)
 *   WINK_WEBHOOK_FIXTURE  Ruta al JSON a enviar (por defecto scripts/fixtures/wink-new-sale.json)
 */

import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const secret = process.env.WINK_WEBHOOK_SECRET

if (!secret) {
  console.error('Falta WINK_WEBHOOK_SECRET.')
  process.exit(1)
}

const url = process.env.WINK_WEBHOOK_URL ?? 'http://127.0.0.1:8787/api/webhooks/wink'
const fixturePath =
  process.env.WINK_WEBHOOK_FIXTURE ??
  fileURLToPath(new URL('./fixtures/wink-new-sale.json', import.meta.url))

const body = await readFile(fixturePath, 'utf8')
const timestamp = Math.floor(Date.now() / 1000).toString()
const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

console.log(`POST ${url}`)
console.log(`X-Wink-Timestamp: ${timestamp}`)
console.log(`X-Wink-Signature: sha256=${signature}`)

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-wink-timestamp': timestamp,
    'x-wink-signature': `sha256=${signature}`,
  },
  body,
})

const responseBody = await response.text()
console.log(`\n${response.status} ${response.statusText}`)
console.log(responseBody)

if (!response.ok) {
  process.exit(1)
}
