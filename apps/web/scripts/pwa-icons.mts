import { copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

copyFileSync(join(publicDir, 'pwa-512x512.png'), join(publicDir, 'maskable-icon-512x512.png'))
await sharp(join(publicDir, 'pwa-512x512.png'))
  .resize(180, 180)
  .toFile(join(publicDir, 'apple-touch-icon-180x180.png'))

console.log('[pwa-icons] maskable + apple-touch alineados con pwa-512')