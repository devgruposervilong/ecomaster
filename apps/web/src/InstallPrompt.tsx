import { useEffect, useState } from 'react'
import { getBannerCopy, getDeviceInfo, getInstallGuide, isStandalone } from './install'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** Oculta el banner solo mientras dure la sesión (vuelve en la próxima visita). */
const DISMISS_KEY = 'ecomaster.installDismissed'

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function InstallPrompt() {
  const [info] = useState(getDeviceInfo)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setShowHelp(false)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Detecta cuando la app se abre desde el icono instalado.
    const media = window.matchMedia?.('(display-mode: standalone)')
    const onDisplayMode = () => setInstalled(isStandalone())
    media?.addEventListener?.('change', onDisplayMode)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      media?.removeEventListener?.('change', onDisplayMode)
    }
  }, [])

  // Deja espacio al final del documento para que el banner no tape el contenido.
  useEffect(() => {
    const active = !installed && !dismissed
    document.body.classList.toggle('has-install-banner', active)
    return () => document.body.classList.remove('has-install-banner')
  }, [installed, dismissed])

  // Escape cierra el panel de instrucciones (web de escritorio).
  useEffect(() => {
    if (!showHelp) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHelp(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHelp])

  if (installed || dismissed) return null

  const guide = getInstallGuide(info)
  const copy = getBannerCopy(info)

  const install = async () => {
    // Prompt nativo disponible (Chrome/Edge/Android): lo disparamos.
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
      return
    }
    // Sin prompt nativo (iOS/Safari, Firefox, in-app…): pasos manuales.
    setShowHelp((open) => !open)
  }

  const copyLink = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      window.prompt('Copia este enlace y ábrelo en tu navegador:', url)
    }
  }

  const close = () => {
    setShowHelp(false)
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* almacenamiento no disponible */
    }
  }

  const primaryLabel = deferredPrompt
    ? 'Instalar ahora'
    : info.isInAppBrowser
      ? 'Ver cómo instalar'
      : 'Cómo instalar'

  return (
    <div
      className={`install-prompt install-prompt--${info.device}`}
      role="region"
      aria-label="Instalar la aplicación Ecomaster"
    >
      {showHelp && (
        <div className="install-help" role="note" aria-live="polite">
          <p className="install-help-title">{guide.title}</p>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.note && <p className="install-help-note">{guide.note}</p>}
          {info.isInAppBrowser && (
            <button type="button" className="install-help-copy" onClick={copyLink}>
              {copied ? 'Enlace copiado ✓' : 'Copiar enlace'}
            </button>
          )}
        </div>
      )}

      <div className="install-prompt-body">
        <img className="install-prompt-logo" src="/pwa-192x192.png" alt="" width={44} height={44} />
        <p className="install-prompt-text">
          <strong>{copy.title}</strong>
          <span>{copy.subtitle}</span>
        </p>
      </div>

      <div className="install-prompt-actions">
        <button
          type="button"
          className="install-prompt-btn"
          onClick={install}
          aria-expanded={showHelp}
        >
          {primaryLabel}
        </button>
        <button type="button" className="install-prompt-close" onClick={close} aria-label="Cerrar">
          ×
        </button>
      </div>
    </div>
  )
}
