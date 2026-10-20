import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

for (const name of [
  'pwa-64x64.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon-180x180.png',
]) {
  const img = sharp(readFileSync(join(publicDir, name)))
  const out = await img.flatten({ background: '#000000' }).png().toBuffer()
  writeFileSync(join(publicDir, name), out)
}

copyFileSync(join(publicDir, 'pwa-512x512.png'), join(publicDir, 'maskable-icon-512x512.png'))
await sharp(join(publicDir, 'pwa-512x512.png'))
  .resize(180, 180)
  .toFile(join(publicDir, 'apple-touch-icon-180x180.png'))

// Favicon: 48x48 sobre fondo negro (el logo es blanco) dentro de un ICO real con
// PNG incrustado. El generador lo deja transparente y se vuelve invisible en
// pestañas claras, así que lo reemplazamos después de generarlo.
const faviconPng = await sharp({
  create: { width: 48, height: 48, channels: 3, background: '#000000' },
})
  .composite([
    {
      input: await sharp(join(publicDir, 'logo-eco-master-bw.png'))
        .resize(44, 44, { fit: 'inside' })
        .toBuffer(),
      gravity: 'center',
    },
  ])
  .png()
  .toBuffer()

const icoHeader = Buffer.alloc(22)
icoHeader.writeUInt16LE(0, 0) // reservado
icoHeader.writeUInt16LE(1, 2) // tipo: ícono
icoHeader.writeUInt16LE(1, 4) // cantidad de imágenes
icoHeader.writeUInt8(48, 6) // ancho
icoHeader.writeUInt8(48, 7) // alto
icoHeader.writeUInt8(0, 8) // colores de paleta
icoHeader.writeUInt8(0, 9) // reservado
icoHeader.writeUInt16LE(1, 10) // planos
icoHeader.writeUInt16LE(32, 12) // bits por píxel
icoHeader.writeUInt32LE(faviconPng.length, 14)
icoHeader.writeUInt32LE(icoHeader.length, 18) // offset de la imagen

writeFileSync(join(publicDir, 'favicon.ico'), Buffer.concat([icoHeader, faviconPng]))

console.log(
  '[pwa-icons] fondo negro aplicado; maskable, apple-touch y favicon alineados con pwa-512',
)
