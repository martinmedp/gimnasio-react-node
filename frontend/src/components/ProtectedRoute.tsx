import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Este componente actúa como un "guardia" para un grupo de rutas.
// Si no hay sesión iniciada, redirige a /login.
// Si sí hay sesión, <Outlet /> renderiza la ruta hija correspondiente.
function ProtectedRoute() {
  const { autenticado } = useAuth()

  if (!autenticado) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute