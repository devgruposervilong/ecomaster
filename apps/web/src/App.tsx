import { useEffect, useState } from 'react'

type Health = { status: string; db?: boolean; storage?: boolean }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline' }))
  }, [])

  return (
    <main>
      <h1>Tools</h1>
      <p>API: {health?.status ?? 'cargando...'}</p>
    </main>
  )
}
