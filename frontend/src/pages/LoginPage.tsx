import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Si llegamos aquí porque la sesión expiró (lo marca api.ts), mostramos
  // un aviso. Se lee en el valor inicial del estado (sin efectos
  // secundarios) y la marca se borra aparte, en el efecto de abajo
  const [aviso] = useState(() =>
    sessionStorage.getItem('sesionExpirada') === '1'
      ? 'Tu sesión expiró. Inicia sesión de nuevo para continuar.'
      : ''
  )

  useEffect(() => {
    sessionStorage.removeItem('sesionExpirada')
  }, [])

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await api.post('/auth/login', { email, password })
      login(response.data.token, response.data.usuario)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciales inválidas')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-lg w-80">
        <h1 className="text-2xl font-bold text-white mb-6">Iniciar sesión</h1>

        {aviso && <p className="text-yellow-300 text-sm mb-4">{aviso}</p>}
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