/**
 * Genera la variante monocroma (blanco) del logo de la marca.
 *
 * El logo original usa blanco + verde (#BCD86C) sobre fondo transparente. Para
 * la marca en blanco y negro basta con pintar todos los píxeles opacos en
 * blanco puro y conservar el canal alfa: la silueta, los bordes suavizados y la
 * vena de la hoja (que es transparencia) se mantienen intactos.
 *
 * Se usa como fuente de los iconos PWA (`pwa-assets.config.ts`), del splash
 * (`pwa-splash.mts`) y del splash inicial de `index.html`.
 *
 * Uso: pnpm --filter @tools/web pwa:monochrome
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const source = join(publicDir, 'logo-eco-master.png')
const output = join(publicDir, 'logo-eco-master-bw.png')

const { data, info } = await sharp(readFileSync(source))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += 4) {
  data[i] = 255
  data[i + 1] = 255
  data[i + 2] = 255
}

const png = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png({ compressionLevel: 9 })
  .toBuffer()

writeFileSync(output, png)

console.log(
  `[monochrome-logo] ${info.width}x${info.height} blanco puro -> public/logo-eco-master-bw.png`,
)
