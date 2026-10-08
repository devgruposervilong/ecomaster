import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DLLS = [
  'concrt140.dll',
  'msvcp140.dll',
  'msvcp140_codecvt_ids.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll',
]

const SOURCE_DIRS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application',
  'C:\\Program Files\\PCHealthCheck',
  'C:\\Users\\finanzas_4\\AppData\\Local\\Microsoft\\OneDrive',
  'C:\\Users\\finanzas_4\\AppData\\Roaming\\Zoom\\bin',
]

function findBinDir() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const pnpmDir = join(root, 'node_modules', '.pnpm')
  if (!existsSync(pnpmDir)) return null
  const entry = readdirSync(pnpmDir).find((d) => d.startsWith('@cloudflare+workerd-windows-64'))
  if (!entry) return null
  return join(pnpmDir, entry, 'node_modules', '@cloudflare', 'workerd-windows-64', 'bin')
}

function findSourceDir() {
  for (const base of SOURCE_DIRS) {
    if (!existsSync(base)) continue
    if (DLLS.every((dll) => existsSync(join(base, dll)))) return base
    const sub = readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(base, e.name))
      .reverse()
    for (const dir of sub) {
      if (DLLS.every((dll) => existsSync(join(dir, dll)))) return dir
    }
  }
  return null
}

if (process.platform !== 'win32') process.exit(0)

const binDir = findBinDir()
if (!binDir || DLLS.every((dll) => existsSync(join(binDir, dll)))) process.exit(0)

const sourceDir = findSourceDir()
if (!sourceDir) {
  console.warn(
    '[workerd-runtime] No se encontró el runtime de Visual C++ 2015-2022. ' +
      'Instala https://aka.ms/vs/17/release/vc_redist.x64.exe para que `wrangler dev` funcione.',
  )
  process.exit(0)
}

for (const dll of DLLS) copyFileSync(join(sourceDir, dll), join(binDir, dll))
console.log(`[workerd-runtime] Runtime de Visual C++ copiado desde ${sourceDir}`)
