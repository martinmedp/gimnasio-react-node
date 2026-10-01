import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await api.post('/auth/login', { email, password })
      // Ahora pasamos también response.data.usuario (que el backend ya
      // venía devolviendo desde el principio, solo que antes lo ignorábamos)
      login(response.data.token, response.data.usuario)
      navigate('/')
    } catch (err: any) {
      // Mostramos el mensaje específico del backend si existe (por ejemplo,
      // "cuenta pendiente de activación"), en vez de un genérico siempre
      setError(err.response?.data?.error || 'Credenciales inválidas')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-lg w-80">
        <h1 className="text-2xl font-bold text-white mb-6">Iniciar sesión</h1>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-slate-700 text-white"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-slate-700 text-white"
        />

        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Entrar
        </button>

        {/* Enlace hacia el registro público, para un Cliente nuevo */}
        <p className="text-slate-400 text-sm text-center mt-4">
          ¿Eres nuevo?{' '}
          <a href="/registro" className="text-blue-400 hover:underline">
            Crea tu cuenta aquí
          </a>
        </p>
      </form>
    </div>
  )
}

export default LoginPage