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

// Interceptor de RESPUESTAS: revisa cada respuesta de error del backend.
// Un 401 significa "no sé quién eres": el token venció o ya no es válido.
// Entonces limpiamos la sesión y mandamos al login, en vez de dejar cada
// pantalla mostrando errores sueltos.
//
// Un 403 NO cierra sesión: significa "sé quién eres, pero no tienes permiso
// para esto", y la sesión sigue siendo válida
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url: string = error.config?.url ?? ''

    // El login también responde 401 cuando la contraseña es incorrecta.
    // Eso no es una sesión vencida, así que las rutas /auth/ se excluyen
    const esRutaDeAutenticacion = url.startsWith('/auth/')

    if (status === 401 && !esRutaDeAutenticacion && !cerrandoSesion) {
      cerrandoSesion = true
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      // Una marca para que el login sepa mostrar el aviso. sessionStorage
      // dura solo mientras la pestaña esté abierta
      sessionStorage.setItem('sesionExpirada', '1')
      // Recarga completa hacia el login: reinicia todo el estado de la
      // aplicación, incluida la sesión que tenía guardada AuthContext
      window.location.href = '/login'
    }

    // Se relanza el error para que cada pantalla que hizo la petición
    // pueda seguir manejándolo como siempre
    return Promise.reject(error)
  }
)

export default api