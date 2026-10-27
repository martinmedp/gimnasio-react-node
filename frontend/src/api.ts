import axios from 'axios'

// Instancia de axios con la URL base del backend ya configurada,
// para no repetir "http://localhost:3000" en cada llamada
const api = axios.create({
  baseURL: 'http://localhost:3000',
})

// Interceptor de PETICIONES: antes de cada petición, si hay un token
// guardado, lo agrega al header Authorization
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Evita disparar la salida varias veces cuando fallan a la vez
// varias peticiones (una pantalla suele hacer 3 o 4 a la vez)
let cerrandoSesion = false

// Interceptor de RESPUESTAS: un 401 significa "no sé quién eres": el token
// venció, o la cuenta fue desactivada o eliminada. Entonces limpiamos la
// sesión y mandamos al login. Un 403 NO cierra sesión: significa "sé quién
// eres, pero no tienes permiso para esto"
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url: string = error.config?.url ?? ''

    // Solo el login y el registro responden 401 por datos incorrectos
    // (contraseña errónea), y eso no es una sesión vencida. Cualquier otra
    // ruta, incluida /auth/me, sí cierra la sesión
    const esLoginORegistro = url === '/auth/login' || url === '/auth/registro-cliente'

    if (status === 401 && !esLoginORegistro && !cerrandoSesion) {
      cerrandoSesion = true
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      // Una marca para que el login muestre el aviso (dura solo mientras
      // la pestaña esté abierta)
      sessionStorage.setItem('sesionExpirada', '1')
      // Recarga completa hacia el login: reinicia todo el estado de la app
      window.location.href = '/login'
    }

    // Se relanza el error para que cada pantalla pueda seguir manejándolo
    return Promise.reject(error)
  }
)

export default api