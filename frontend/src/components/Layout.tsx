import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Layout() {
  const { logout, usuario } = useAuth()
  const esCliente = usuario?.rol === 'Cliente'

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 p-4 flex justify-between items-center">
        <div className="flex gap-4 items-center flex-wrap">
          <Link to="/" className="text-white font-bold">
            Gimnasio
          </Link>

          {!esCliente && (
            <>
              <Link to="/clientes" className="text-slate-300 hover:text-white">
                Clientes
              </Link>
              <Link to="/ejercicios" className="text-slate-300 hover:text-white">
                Ejercicios
              </Link>
              {(usuario?.rol === 'Administrador' || usuario?.rol === 'Recepcionista') && (
                <>
                  <Link to="/planes" className="text-slate-300 hover:text-white">
                    Planes
                  </Link>
                  <Link to="/asistencia" className="text-slate-300 hover:text-white">
                    Asistencia
                  </Link>
                  {/* Contabilidad: solo Administrador y Recepcionista */}
                  <Link to="/pagos" className="text-slate-300 hover:text-white">
                    Pagos
                  </Link>
                  <Link to="/cierres" className="text-slate-300 hover:text-white">
                    Cierres
                  </Link>
                </>
              )}
              {usuario?.rol === 'Administrador' && (
                <Link to="/usuarios" className="text-slate-300 hover:text-white">
                  Usuarios
                </Link>
              )}
              <Link to="/entrenadores" className="text-slate-300 hover:text-white">
                Entrenadores
              </Link>
            </>
          )}

          {esCliente && usuario?.clienteId && (
            <>
              <Link to="/mi-perfil" className="text-slate-300 hover:text-white">
                Mi perfil
              </Link>
              <Link to={`/clientes/${usuario.clienteId}/medidas`} className="text-slate-300 hover:text-white">
                Mi progreso
              </Link>
              <Link to={`/clientes/${usuario.clienteId}/rutinas`} className="text-slate-300 hover:text-white">
                Mi rutina
              </Link>
              <Link to={`/clientes/${usuario.clienteId}/membresia`} className="text-slate-300 hover:text-white">
                Mi membresía
              </Link>
              <Link to="/entrenadores" className="text-slate-300 hover:text-white">
                Entrenadores
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {usuario && (
            <span className="text-slate-400 text-sm">
              {usuario.nombre} ({usuario.rol})
            </span>
          )}
          <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout