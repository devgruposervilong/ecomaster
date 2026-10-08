import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setHidden(true)
      return
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setHidden(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden || !deferredPrompt) return null

  const install = async () => {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setHidden(true)
    setDeferredPrompt(null)
  }

  const dismiss = () => setDeferredPrompt(null)

  return (
    <div className="install-prompt" role="region" aria-label="Instalar la aplicación">
      <span className="install-prompt-text">
        Instala <strong>Ecomaster</strong> en tu dispositivo
      </span>
      <div className="install-prompt-actions">
        <button type="button" className="install-prompt-btn" onClick={install}>
          Instalar
        </button>
        <button
          type="button"
          className="install-prompt-close"
          onClick={dismiss}
          aria-label="Cerrar"
        >
          x
        </button>
      </div>
    </div>
  )
}