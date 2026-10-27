import { useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

// Componente sin apariencia: al montarse, pide al backend los datos
// actuales del usuario y actualiza los que la interfaz tiene guardados
// (rol, nombre, clienteId). Así, si le cambiaron el rol a alguien con la
// sesión abierta, el menú y las pantallas lo reflejan al recargar, en vez
// de seguir mostrando el rol con el que inició sesión.
//
// Si la cuenta fue desactivada o eliminada, el backend responde 401 y el
// interceptor de api.ts cierra la sesión por su cuenta
function SincronizarSesion() {
  const { login } = useAuth()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // login(token, usuario) guarda los datos nuevos en el contexto y en
    // localStorage, con el mismo token de siempre. Un fallo de red se
    // ignora: se sigue con los datos que ya había
    api
      .get('/auth/me')
      .then((response) => login(token, response.data))
      .catch(() => { })
    // Se ejecuta una sola vez, al montarse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default SincronizarSesion