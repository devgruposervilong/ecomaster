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

console.log('[pwa-icons] fondo negro aplicado; maskable + apple-touch alineados con pwa-512')