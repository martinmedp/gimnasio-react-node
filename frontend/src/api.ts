import axios from 'axios'


// Dirección del backend. Sale de la variable VITE_API_URL (archivo .env del
// frontend) y, si no existe, usa la de desarrollo. Vite sustituye este valor
// al compilar. IMPORTANTE: todo lo que empieza con VITE_ queda dentro del
// código que recibe el navegador, así que nunca se ponen secretos ahí.
// Se exporta para armar las direcciones de las imágenes (fotos, ejercicios)
export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Instancia de axios con la URL base ya configurada
const api = axios.create({
  baseURL: API_URL,
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
    // (contraseña errónea), y eso no es una sesión vencida
    const esLoginORegistro = url === '/auth/login' || url === '/auth/registro-cliente'

    if (status === 401 && !esLoginORegistro && !cerrandoSesion) {
      cerrandoSesion = true
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      sessionStorage.setItem('sesionExpirada', '1')
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api