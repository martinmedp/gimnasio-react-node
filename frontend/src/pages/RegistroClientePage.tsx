import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

function RegistroClientePage() {
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // Controla si ya se envió el registro exitosamente, para mostrar
  // un mensaje de confirmación en vez del formulario
  const [registroExitoso, setRegistroExitoso] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!nombre || !documento || !email || !password) {
      setError('Nombre, documento, email y contraseña son obligatorios')
      return
    }

    try {
      // Este endpoint es público: no requiere token, cualquiera puede llamarlo
      await api.post('/auth/registro-cliente', { nombre, documento, email, telefono, password })
      setRegistroExitoso(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrar la cuenta')
    }
  }

  // Vista de confirmación tras un registro exitoso: reemplaza todo el
  // formulario por un mensaje claro de qué sigue
  if (registroExitoso) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-lg w-96 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">¡Registro exitoso!</h1>
          <p className="text-slate-300 mb-6">
            Tu cuenta fue creada correctamente. Un administrador del gimnasio debe
            activarla antes de que puedas iniciar sesión. Te avisaremos cuando esté lista.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-lg w-96">
        <h1 className="text-2xl font-bold text-white mb-2">Crear cuenta</h1>
        <p className="text-slate-400 text-sm mb-6">
          Regístrate como cliente del gimnasio. Tu cuenta deberá ser activada por un administrador.
        </p>

        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        <input
          type="text"
          placeholder="Nombre completo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full p-2 mb-3 rounded bg-slate-700 text-white"
        />
        <input
          type="text"
          placeholder="Documento"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          className="w-full p-2 mb-3 rounded bg-slate-700 text-white"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 rounded bg-slate-700 text-white"
        />
        <input
          type="text"
          placeholder="Teléfono (opcional)"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="w-full p-2 mb-3 rounded bg-slate-700 text-white"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-slate-700 text-white"
        />

        <button type="submit" className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700">
          Registrarme
        </button>

        <p className="text-slate-400 text-sm text-center mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-400 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  )
}

export default RegistroClientePage