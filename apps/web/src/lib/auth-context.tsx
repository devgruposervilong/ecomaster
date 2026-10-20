import { createContext, useContext, type ReactNode } from 'react'
import type { Me } from './queries'

const AuthContext = createContext<Me | null>(null)

export function AuthProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <AuthContext.Provider value={me}>{children}</AuthContext.Provider>
}

export function useMe() {
  const me = useContext(AuthContext)
  if (!me) {
    throw new Error('useMe debe usarse dentro de AuthProvider.')
  }
  return me
}
