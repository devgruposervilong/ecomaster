import { useEffect, useState } from 'react'
import { Check, ChevronDown, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDeviceInfo, getInstallGuide, isStandalone } from '@/install'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallCard() {
  const [info] = useState(getDeviceInfo)
  const [installed, setInstalled] = useState(isStandalone)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showGuide, setShowGuide] = useState(false)

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

  const guide = getInstallGuide(info)

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
      return
    }
    setShowGuide((open) => !open)
  }

  return (
    <div className="rounded-[26px] border border-black/10 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#BCD86C]">
          {installed ? (
            <Check className="size-4 text-[#0A0A0A]" />
          ) : (
            <Download className="size-4 text-[#0A0A0A]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0A0A0A]">
            {installed ? 'Aplicación instalada' : 'Instala Eco Master'}
          </p>
          <p className="mt-1 text-xs leading-5 text-black/45">
            {installed
              ? 'Estás usando la app desde tu dispositivo. El acceso directo ya está listo.'
              : 'Abre el backoffice como una app, sin barra del navegador y con acceso directo.'}
          </p>

          {!installed ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={install}
                className="h-9 rounded-xl bg-[#0A0A0A] text-white hover:bg-black/85"
              >
                {deferredPrompt ? (
                  <>
                    <Download className="size-4" />
                    Instalar ahora
                  </>
                ) : (
                  <>
                    <Share2 className="size-4" />
                    Cómo instalar
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowGuide((open) => !open)}
                className="h-9 rounded-xl text-black/55"
              >
                Ver pasos
                <ChevronDown
                  className={`size-4 transition-transform ${showGuide ? 'rotate-180' : ''}`}
                />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {showGuide && !installed ? (
        <div className="mt-4 rounded-2xl bg-black/[0.03] p-4">
          <p className="text-xs font-medium text-[#0A0A0A]">{guide.title}</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-5 text-black/50">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.note ? (
            <p className="mt-2 text-[11px] leading-5 text-black/35">{guide.note}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
