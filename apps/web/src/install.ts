/**
 * Detección de plataforma y guías de instalación para la PWA.
 *
 * Cubre los tres escenarios principales:
 *  - iOS / iPadOS (Safari y navegadores WebKit): instalación manual vía Compartir.
 *  - Android (Chrome, Edge, Firefox, Samsung Internet, Opera): prompt nativo o menú.
 *  - Web de escritorio (Chrome, Edge, Opera, Safari, Firefox).
 *
 * También detecta navegadores in-app (Instagram, Facebook, WhatsApp, TikTok…),
 * donde las PWAs no se pueden instalar y hay que abrir el enlace fuera.
 */

export type DeviceType = 'ios' | 'android' | 'desktop'

export type BrowserType = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'other'

export interface DeviceInfo {
  device: DeviceType
  browser: BrowserType
  /** Navegador embebido dentro de otra app (no permite instalar). */
  isInAppBrowser: boolean
  /** La PWA ya se está ejecutando como app instalada. */
  isStandalone: boolean
}

export interface InstallGuide {
  title: string
  steps: string[]
  note?: string
}

const IN_APP_RE =
  /FBAN|FBAV|Instagram|WhatsApp|TikTok|Twitter|LinkedInApp|Snapchat|Line\/|MicroMessenger|Pinterest|Telegram|GSA\/|; wv\)/i

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia
  const displayMode =
    (mq?.('(display-mode: standalone)').matches ?? false) ||
    (mq?.('(display-mode: fullscreen)').matches ?? false) ||
    (mq?.('(display-mode: minimal-ui)').matches ?? false) ||
    (mq?.('(display-mode: window-controls-overlay)').matches ?? false)

  return (
    displayMode || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function getDeviceInfo(): DeviceInfo {
  if (typeof navigator === 'undefined') {
    return { device: 'desktop', browser: 'other', isInAppBrowser: false, isStandalone: false }
  }

  const ua = navigator.userAgent

  // iPadOS 13+ se identifica como Mac, pero tiene pantalla táctil.
  const isIos =
    /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const isAndroid = /android/i.test(ua)

  // El orden importa: Edge/Opera/Samsung/Firefox incluyen "Chrome" en su UA.
  let browser: BrowserType = 'other'
  if (/edg(a|ios)?\//i.test(ua)) browser = 'edge'
  else if (/opr\/|opios|opera/i.test(ua)) browser = 'opera'
  else if (/samsungbrowser/i.test(ua)) browser = 'samsung'
  else if (/firefox|fxios/i.test(ua)) browser = 'firefox'
  else if (/chrome|crios/i.test(ua)) browser = 'chrome'
  else if (/safari/i.test(ua)) browser = 'safari'

  return {
    device: isIos ? 'ios' : isAndroid ? 'android' : 'desktop',
    browser,
    isInAppBrowser: IN_APP_RE.test(ua),
    isStandalone: isStandalone(),
  }
}

/** Instrucciones concretas según dispositivo y navegador. */
export function getInstallGuide(info: DeviceInfo): InstallGuide {
  if (info.isInAppBrowser) {
    return {
      title: 'Ábrela en tu navegador para instalarla',
      steps: [
        'Toca el menú (⋯ o ⋮) de esta ventana.',
        'Elige «Abrir en el navegador», «Abrir en Safari» o «Abrir en Chrome».',
        'Ya en el navegador, toca «Instalar» otra vez.',
      ],
      note: 'Los navegadores integrados de Instagram, Facebook, WhatsApp y similares no permiten instalar PWAs.',
    }
  }

  if (info.device === 'ios') {
    return {
      title: 'Instalar en iPhone / iPad',
      steps: [
        'Toca el botón Compartir (el cuadro con la flecha hacia arriba).',
        'Desliza y elige «Añadir a pantalla de inicio».',
        'Toca «Añadir»: el icono aparecerá en tu pantalla de inicio.',
      ],
      note:
        info.browser === 'safari'
          ? undefined
          : 'En iOS todos los navegadores usan el menú Compartir del sistema.',
    }
  }

  if (info.device === 'android') {
    switch (info.browser) {
      case 'chrome':
        return {
          title: 'Instalar en Android (Chrome)',
          steps: [
            'Toca el menú ⋮ en la esquina superior derecha.',
            'Elige «Instalar aplicación» o «Añadir a pantalla de inicio».',
            'Confirma en el diálogo.',
          ],
        }
      case 'edge':
        return {
          title: 'Instalar en Android (Edge)',
          steps: [
            'Toca el menú ⋯ en la parte inferior.',
            'Elige «Añadir a teléfono» y luego «Instalar».',
            'Confirma en el diálogo.',
          ],
        }
      case 'firefox':
        return {
          title: 'Instalar en Android (Firefox)',
          steps: [
            'Toca el menú ⋮.',
            'Elige «Instalar» o «Añadir a pantalla de inicio».',
            'Confirma en el diálogo.',
          ],
        }
      case 'samsung':
        return {
          title: 'Instalar en Android (Samsung Internet)',
          steps: [
            'Toca el menú ☰ en la parte inferior.',
            'Elige «Añadir página a» y luego «Pantalla de inicio».',
            'Confirma en el diálogo.',
          ],
        }
      case 'opera':
        return {
          title: 'Instalar en Android (Opera)',
          steps: [
            'Toca el menú ☰.',
            'Elige «Añadir a pantalla de inicio».',
            'Confirma en el diálogo.',
          ],
        }
      default:
        return {
          title: 'Instalar en Android',
          steps: [
            'Abre el menú del navegador.',
            'Elige «Instalar aplicación» o «Añadir a pantalla de inicio».',
            'Confirma en el diálogo.',
          ],
        }
    }
  }

  switch (info.browser) {
    case 'chrome':
      return {
        title: 'Instalar en tu equipo (Chrome)',
        steps: [
          'Haz clic en el icono de instalar de la barra de direcciones o en el menú ⋮.',
          'Elige «Instalar Ecomaster».',
          'Confirma con «Instalar».',
        ],
      }
    case 'edge':
      return {
        title: 'Instalar en tu equipo (Edge)',
        steps: [
          'Haz clic en el icono de instalar de la barra de direcciones o en el menú ⋯.',
          'Elige «Aplicaciones» y luego «Instalar este sitio como aplicación».',
          'Confirma con «Instalar».',
        ],
      }
    case 'opera':
      return {
        title: 'Instalar en tu equipo (Opera)',
        steps: [
          'Haz clic en el icono de instalar de la barra de direcciones.',
          'Elige «Instalar Ecomaster».',
          'Confirma con «Instalar».',
        ],
      }
    case 'safari':
      return {
        title: 'Instalar en tu Mac (Safari)',
        steps: [
          'En macOS Sonoma o superior, abre el menú Compartir.',
          'Elige «Añadir al Dock».',
          'Confirma con «Añadir».',
        ],
        note: 'En versiones anteriores de macOS, usa Chrome o Edge para instalarla como app.',
      }
    case 'firefox':
      return {
        title: 'Instalar en tu equipo (Firefox)',
        steps: [
          'Firefox no permite instalar aplicaciones web.',
          'Abre Ecomaster en Chrome o Edge.',
          'Usa el icono de instalar de la barra de direcciones.',
        ],
        note: 'Como alternativa, crea un marcador para tenerla siempre a mano.',
      }
    default:
      return {
        title: 'Instalar en tu equipo',
        steps: [
          'Busca el icono de instalar en la barra de direcciones o en el menú del navegador.',
          'Elige «Instalar aplicación».',
          'Confirma con «Instalar».',
        ],
      }
  }
}

/** Texto del banner adaptado al dispositivo. */
export function getBannerCopy(info: DeviceInfo): { title: string; subtitle: string } {
  if (info.isInAppBrowser) {
    return {
      title: 'Abre Eco Master en tu navegador',
      subtitle: 'Desde aquí no se puede instalar. Te indicamos cómo abrirla.',
    }
  }

  if (info.device === 'ios') {
    return {
      title: 'Instala Eco Master',
      subtitle: 'Añádela a tu pantalla de inicio y úsala como una app.',
    }
  }

  if (info.device === 'android') {
    return {
      title: 'Instala Eco Master',
      subtitle: 'Acceso directo desde tu inicio y disponible sin conexión.',
    }
  }

  return {
    title: 'Instala Eco Master en tu equipo',
    subtitle: 'Ábrela como una app, sin navegador y con acceso directo.',
  }
}
