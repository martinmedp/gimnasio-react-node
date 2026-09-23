import axios from 'axios'

// Instancia de axios con la URL base del backend ya configurada,
// para no repetir "http://localhost:3000" en cada llamada
const api = axios.create({
  baseURL: 'http://localhost:3000',
})

// Interceptor: se ejecuta automáticamente ANTES de cada petición que hagamos con "api"
// Aquí revisamos si hay un token guardado, y si existe, lo agregamos al header Authorization
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api