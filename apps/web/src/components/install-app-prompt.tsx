import { useEffect, useState } from 'react'
import { Download, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBannerCopy, getDeviceInfo, getInstallGuide, isStandalone } from '@/install'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** El aviso se oculta durante la sesión actual y vuelve en la próxima visita. */
const DISMISS_KEY = 'ecomaster.installPromptDismissed'

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallAppPrompt() {
  const [info] = useState(getDeviceInfo)
  const [installed, setInstalled] = useState(isStandalone)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [showGuide, setShowGuide] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setShowGuide(false)
    }
    const media = window.matchMedia?.('(display-mode: standalone)')
    const onDisplayMode = () => setInstalled(isStandalone())

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    media?.addEventListener?.('change', onDisplayMode)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      media?.removeEventListener?.('change', onDisplayMode)
    }
  }, [])

  if (installed || dismissed) return null

  const guide = getInstallGuide(info)
  const copy = getBannerCopy(info)

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
      return
    }

    setShowGuide(true)
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
    setDismissed(true)
    setShowGuide(false)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* almacenamiento no disponible */
    }
  }

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
      aria-label="Instalar la aplicación Eco Master"
    >
      <div className="rounded-[26px] border border-black/10 bg-white p-4 shadow-[0_18px_60px_rgba(10,10,10,0.16)]">
        <div className="flex items-start gap-3">
          <img
            className="size-11 shrink-0 rounded-2xl"
            src="/pwa-192x192.png"
            alt=""
            width={44}
            height={44}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0A0A0A]">{copy.title}</p>
            <p className="mt-1 text-xs leading-5 text-black/50">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-black/35 transition-colors hover:bg-black/[0.04] hover:text-[#0A0A0A]"
            onClick={close}
            aria-label="Cerrar aviso de instalación"
          >
            <X className="size-4" />
          </button>
        </div>

        {showGuide ? (
          <div className="mt-4 rounded-2xl bg-black/[0.03] p-3.5" role="note">
            <p className="text-xs font-medium text-[#0A0A0A]">{guide.title}</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-5 text-black/50">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {guide.note ? (
              <p className="mt-2 text-[11px] leading-5 text-black/35">{guide.note}</p>
            ) : null}
            {info.isInAppBrowser ? (
              <Button
                type="button"
                variant="ghost"
                onClick={copyLink}
                className="mt-2 h-8 rounded-lg px-2 text-xs text-[#0A0A0A]"
              >
                {copied ? 'Enlace copiado' : 'Copiar enlace'}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            onClick={install}
            className="h-9 flex-1 rounded-xl bg-[#0A0A0A] text-white hover:bg-black/85"
          >
            {deferredPrompt ? <Download className="size-4" /> : <Share2 className="size-4" />}
            {deferredPrompt
              ? 'Instalar ahora'
              : info.isInAppBrowser
                ? 'Cómo abrirla'
                : 'Cómo instalar'}
          </Button>
          {!showGuide ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowGuide(true)}
              className="h-9 rounded-xl px-3 text-black/55"
            >
              Ver pasos
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
