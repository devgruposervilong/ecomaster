import type { QueryClient } from '@tanstack/react-query'
import { authClient } from './auth-client'

/**
 * El service worker dejó de cachear /api/*, pero una versión anterior pudo
 * haber guardado respuestas autenticadas en el runtime cache. Al cerrar sesión
 * borramos esos caches para que no queden datos de un aliado en el dispositivo.
 */
export async function clearPrivateCaches() {
  if (typeof caches === 'undefined') return

  try {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.includes('runtime') || key.includes('api'))
        .map((key) => caches.delete(key)),
    )
  } catch {
    /* El navegador puede bloquear caches en modo privado. */
  }
}

export async function signOutAndReset(queryClient: QueryClient) {
  await authClient.signOut()
  queryClient.clear()
  await clearPrivateCaches()
}

export function authErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  fallback = 'No pudimos completar la operación.',
) {
  switch (error?.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'Correo o contraseña incorrectos.'
    case 'BANNED_USER':
      return 'Tu cuenta está suspendida. Contacta a Eco Master.'
    case 'INVALID_PASSWORD':
      return 'La contraseña actual no es correcta.'
    case 'TOO_MANY_REQUESTS':
      return 'Demasiados intentos. Espera un momento e intenta de nuevo.'
    default:
      return error?.message || fallback
  }
}
