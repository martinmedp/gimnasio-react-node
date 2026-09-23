import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Layout() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Link to="/" className="text-white font-bold">
            Gimnasio
          </Link>
          <Link to="/clientes" className="text-slate-300 hover:text-white">
            Clientes
          </Link>
          <Link to="/ejercicios" className="text-slate-300 hover:text-white">
            Ejercicios
          </Link>
        </div>
        <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          Cerrar sesión
        </button>
      </nav>

      <main className="p-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout