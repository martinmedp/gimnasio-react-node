import { createContext, useContext, useState, ReactNode } from 'react'

// Forma de los datos y funciones que el contexto va a exponer
interface AuthContextType {
  autenticado: boolean
  login: (token: string) => void
  logout: () => void
}

// Creamos el contexto. El valor inicial es undefined porque solo tendrá
// datos reales una vez esté dentro de <AuthProvider>
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// AuthProvider envuelve toda la aplicación y le da a cualquier componente
// hijo acceso al estado de autenticación, sin tener que pasarlo a mano
// componente por componente (esto se llama "prop drilling", y el Context lo evita)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(!!localStorage.getItem('token'))

  const login = (token: string) => {
    localStorage.setItem('token', token)
    setAutenticado(true)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setAutenticado(false)
  }

  return (
    <AuthContext.Provider value={{ autenticado, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook personalizado para consumir el contexto fácilmente.
// En vez de escribir useContext(AuthContext) en cada componente,
// simplemente escribimos useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}