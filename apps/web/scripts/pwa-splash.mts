/**
 * Genera los splash screen (pantallas de arranque) de iOS/iPadOS.
 *
 * Android crea el splash automáticamente desde el manifest (background_color +
 * icono), pero Safari en iOS no usa el manifest: necesita imágenes
 * `apple-touch-startup-image` declaradas en el HTML. Si falta la imagen que
 * corresponde al dispositivo, iOS muestra una pantalla en blanco.
 *
 * Este script:
 *   1. Recorta los márgenes transparentes del logo de la marca.
 *   2. Compone el logo centrado sobre fondo negro para cada dispositivo y
 *      orientación (mismo color que el icono y que background_color).
 *   3. Escribe los <link> correspondientes en index.html entre los marcadores
 *      BEGIN/END:pwa-splash, para que el HTML nunca se desincronice.
 *
 * Uso: pnpm --filter @tools/web pwa:splash   (o `pnpm build` de assets)
 *
 * Nota: el bloque de <link> se escribe en una línea por dispositivo; después de
 * regenerar conviene ejecutar `pnpm format` para dejarlo con el formato de
 * Prettier que ya tiene index.html.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(webDir, 'public')
const splashDir = join(publicDir, 'splash')
const indexPath = join(webDir, 'index.html')
const logoPath = join(publicDir, 'logo-eco-master-bw.png')

/** Igual que el fondo del icono y que `background_color` del manifest. */
const BACKGROUND = '#0A0A0A'
/** El logo ocupa el 60% del lado corto de la pantalla (uniforme en todas). */
const LOGO_SHORT_EDGE_RATIO = 0.6
/** Tope de altura para que no domine la pantalla en orientaciones extremas. */
const LOGO_MAX_LONG_EDGE_RATIO = 0.25

interface DeviceClass {
  /** Nombre legible, solo informativo. */
  name: string
  /** Tamaño en píxeles CSS, en vertical. */
  width: number
  height: number
  dpr: number
}

/**
 * Clases de dispositivo que Safari distingue por media query
 * (device-width/device-height en px CSS + -webkit-device-pixel-ratio).
 */
const DEVICES: DeviceClass[] = [
  { name: 'iPhone SE (1ª gen) / iPod touch', width: 320, height: 568, dpr: 2 },
  { name: 'iPhone SE 2-3 / 8', width: 375, height: 667, dpr: 2 },
  { name: 'iPhone X / XS / 11 Pro / 12-13 mini', width: 375, height: 812, dpr: 3 },
  { name: 'iPhone 12 / 13 / 14', width: 390, height: 844, dpr: 3 },
  { name: 'iPhone 14 Pro / 15 / 15 Pro / 16', width: 393, height: 852, dpr: 3 },
  { name: 'iPhone 16 Pro', width: 402, height: 874, dpr: 3 },
  { name: 'iPhone XR / 11', width: 414, height: 896, dpr: 2 },
  { name: 'iPhone XS Max / 11 Pro Max', width: 414, height: 896, dpr: 3 },
  { name: 'iPhone 12-13 Pro Max / 14 Plus', width: 428, height: 926, dpr: 3 },
  { name: 'iPhone 14 Pro Max / 15 Plus / 15-16 Pro Max', width: 430, height: 932, dpr: 3 },
  { name: 'iPhone 16 Pro Max', width: 440, height: 956, dpr: 3 },
  { name: 'iPad mini 5 / 9.7"', width: 768, height: 1024, dpr: 2 },
  { name: 'iPad mini 6', width: 744, height: 1133, dpr: 2 },
  { name: 'iPad 8ª-9ª gen', width: 810, height: 1080, dpr: 2 },
  { name: 'iPad Air 4-5 / iPad 10 / Air 11', width: 820, height: 1180, dpr: 2 },
  { name: 'iPad Pro 10.5 / Air 3ª gen', width: 834, height: 1112, dpr: 2 },
  { name: 'iPad Pro 11"', width: 834, height: 1194, dpr: 2 },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, dpr: 2 },
]

type Orientation = 'portrait' | 'landscape'

function mediaQuery(device: DeviceClass, orientation: Orientation): string {
  const width = orientation === 'portrait' ? device.width : device.height
  const height = orientation === 'portrait' ? device.height : device.width
  return (
    `screen and (device-width: ${width}px) and (device-height: ${height}px)` +
    ` and (-webkit-device-pixel-ratio: ${device.dpr}) and (orientation: ${orientation})`
  )
}

function physicalSize(device: DeviceClass, orientation: Orientation): [number, number] {
  const width = device.width * device.dpr
  const height = device.height * device.dpr
  return orientation === 'portrait' ? [width, height] : [height, width]
}

/** Logo recortado (sin márgenes transparentes) para centrarlo con precisión. */
const logo = await sharp(readFileSync(logoPath)).trim().png().toBuffer()
const logoMeta = await sharp(logo).metadata()
const logoWidth = logoMeta.width ?? 1
const logoHeight = logoMeta.height ?? 1

rmSync(splashDir, { recursive: true, force: true })
mkdirSync(splashDir, { recursive: true })

const links: string[] = []
let bytes = 0

for (const device of DEVICES) {
  for (const orientation of ['portrait', 'landscape'] as const) {
    const [width, height] = physicalSize(device, orientation)
    const shortEdge = Math.min(width, height)
    const longEdge = Math.max(width, height)

    const targetWidth = Math.round(
      Math.min(
        shortEdge * LOGO_SHORT_EDGE_RATIO,
        (longEdge * LOGO_MAX_LONG_EDGE_RATIO * logoWidth) / logoHeight,
      ),
    )
    const targetHeight = Math.round((targetWidth * logoHeight) / logoWidth)

    const resized = await sharp(logo)
      .resize(targetWidth, targetHeight, { fit: 'inside' })
      .toBuffer()

    const file = `${width}x${height}.png`
    const output = await sharp({
      create: { width, height, channels: 3, background: BACKGROUND },
    })
      .composite([{ input: resized, gravity: 'center' }])
      // Paleta: el diseño es plano, así que el PNG pesa ~3 veces menos.
      .png({ compressionLevel: 9, palette: true, colours: 256 })
      .toFile(join(splashDir, file))

    bytes += output.size
    links.push(
      `    <link rel="apple-touch-startup-image" media="${mediaQuery(device, orientation)}" href="/splash/${file}" />`,
    )
  }
}

const block = [
  '    <!-- BEGIN:pwa-splash (generado por scripts/pwa-splash.mts) -->',
  ...links,
  '    <!-- END:pwa-splash -->',
].join('\n')

const html = readFileSync(indexPath, 'utf8')
const start = html.indexOf('<!-- BEGIN:pwa-splash')
const end = html.indexOf('<!-- END:pwa-splash -->')

if (start === -1 || end === -1) {
  throw new Error(
    'No se encontraron los marcadores BEGIN/END:pwa-splash en index.html. ' +
      'Añádelos (vacíos) antes de ejecutar este script.',
  )
}

const endOfLine = html.indexOf('\n', end)
const updated = html.slice(0, start) + block.trimStart() + html.slice(endOfLine)

if (updated !== html) {
  writeFileSync(indexPath, updated)
}

console.log(
  `[pwa-splash] ${DEVICES.length} dispositivos x 2 orientaciones = ${links.length} imágenes ` +
    `(${(bytes / 1024 / 1024).toFixed(2)} MB) + ${links.length} <link> en index.html`,
)
