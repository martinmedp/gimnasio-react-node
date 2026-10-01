import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
// Forma de los datos del usuario logueado, guardados junto al token
interface Usuario {
  id: number
  nombre: string
  email: string
  rol: string
  clienteId: number | null
}

interface AuthContextType {
  autenticado: boolean
  usuario: Usuario | null
  // login ahora recibe el token Y los datos del usuario (antes solo recibía el token)
  login: (token: string, usuario: Usuario) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(!!localStorage.getItem('token'))

  // Al cargar la app, si ya había una sesión guardada, recuperamos también
  // los datos del usuario desde localStorage (no solo el token).
  // JSON.parse convierte el texto guardado de vuelta a un objeto JS;
  // si no hay nada guardado, usuarioGuardado queda en null
  const usuarioGuardado = localStorage.getItem('usuario')
  const [usuario, setUsuario] = useState<Usuario | null>(
    usuarioGuardado ? JSON.parse(usuarioGuardado) : null
  )

  const login = (token: string, datosUsuario: Usuario) => {
    localStorage.setItem('token', token)
    // JSON.stringify convierte el objeto a texto, porque localStorage
    // solo puede guardar strings, nunca objetos directamente
    localStorage.setItem('usuario', JSON.stringify(datosUsuario))
    setUsuario(datosUsuario)
    setAutenticado(true)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
    setAutenticado(false)
  }

  return (
    <AuthContext.Provider value={{ autenticado, usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}