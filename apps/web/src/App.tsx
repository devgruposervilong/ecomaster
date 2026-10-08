import { useCallback, useEffect, useState } from 'react'
import InstallPrompt from './InstallPrompt'

type Health = { status: string; db?: boolean }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  const check = useCallback(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline' }))
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return (
    <main>
      <InstallPrompt />
      <h1>Ecomaster</h1>
      <p>
        API: {health?.status ?? 'cargando...'} {!online && '(sin conexión)'}
      </p>
      <p>
        <strong>Estado:</strong> {online ? 'Con conexión' : 'Offline'} · Instalable como PWA
      </p>
      <button type="button" onClick={check} disabled={!online}>
        Reintentar
      </button>
    </main>
  )
}