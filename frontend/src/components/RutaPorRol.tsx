import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface RutaPorRolProps {
  // Roles que pueden entrar a las rutas que envuelve este componente
  roles: string[]
}

// Guardia de acceso por rol, a nivel de ruta. Funciona igual que
// ProtectedRoute (que exige haber iniciado sesión), pero además exige un
// rol concreto. Si el rol no está en la lista, en vez de mostrar la pantalla
// muestra un aviso, y la pantalla ni siquiera se monta: no se hacen
// peticiones al backend que de todas formas rechazaría.
//
// Es una comodidad de la interfaz, no la seguridad: la protección real
// sigue estando en el backend (verificarRol en cada endpoint)
function RutaPorRol({ roles }: RutaPorRolProps) {
  const { usuario } = useAuth()

  if (!usuario || !roles.includes(usuario.rol)) {
    return <p className="text-red-400">No tienes acceso a esta sección.</p>
  }

  // <Outlet /> dibuja la pantalla hija que corresponda a la URL
  return <Outlet />
}

export default RutaPorRol