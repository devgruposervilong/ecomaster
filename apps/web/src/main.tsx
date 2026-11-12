import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { registerSW } from 'virtual:pwa-register'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query-client'
import { router } from '@/router'
import './index.css'

/** Cada cuánto se busca una versión nueva mientras la app sigue abierta. */
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000

/**
 * `registerType: 'autoUpdate'` hace que el service worker nuevo se active solo
 * (skipWaiting + clientsClaim) y que la página se recargue al terminar.
 *
 * El problema es que el navegador solo comprueba si hay versión nueva al
 * cargar la página. En móvil la PWA se reanuda desde segundo plano sin
 * recargar, así que forzamos la comprobación al volver a la app y cada 30 min.
 */
function watchForUpdates(registration: ServiceWorkerRegistration) {
  let lastCheck = 0

  const check = () => {
    // Evita duplicar peticiones cuando llegan focus + visibilitychange juntos.
    if (Date.now() - lastCheck < 60_000) return
    lastCheck = Date.now()

    registration.update().catch(() => {
      /* sin red o error puntual: se reintenta en la próxima comprobación */
    })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
  window.setInterval(check, UPDATE_CHECK_INTERVAL)
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) watchForUpdates(registration)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
