import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MenuDesplegable from './MenuDesplegable'
import SincronizarSesion from './SincronizarSesion'

function Layout() {
  const { logout, usuario } = useAuth()

  const rol = usuario?.rol
  const esCliente = rol === 'Cliente'
  // Quienes manejan la parte comercial y el dinero del gimnasio
  const gestionaNegocio = rol === 'Administrador' || rol === 'Recepcionista'

  // Grupo GIMNASIO: lo que es estrictamente del funcionamiento del gimnasio.
  // Los items se arman con un arreglo para poder incluir o no cada opción
  // según el rol. El Entrenador solo ve Clientes, Ejercicios y Entrenadores
  const itemsGimnasio = [
    { to: '/clientes', texto: 'Clientes' },
    { to: '/ejercicios', texto: 'Ejercicios' },
    ...(gestionaNegocio
      ? [
        { to: '/planes', texto: 'Planes' },
        { to: '/asistencia', texto: 'Asistencia' },
      ]
      : []),
    { to: '/entrenadores', texto: 'Entrenadores' },
  ]

  // Grupo DINERO: todo el manejo financiero. Solo Administrador y Recepcionista
  const itemsDinero = [
    { to: '/pagos', texto: 'Pagos' },
    { to: '/gastos', texto: 'Gastos' },
    { to: '/categorias-gasto', texto: 'Categorías de gasto' },
    { to: '/cierres', texto: 'Cierres' },
  ]

  return (
    <div className="min-h-screen bg-slate-900">
      <SincronizarSesion />
      <nav className="sticky top-0 z-40 bg-slate-800 p-4 flex justify-between items-center">
        <div className="flex gap-4 items-center flex-wrap">
          <Link to="/" className="text-white font-bold">
            Gimnasio
          </Link>

          {/* Menú del PERSONAL: dos grupos desplegables y, aparte, Usuarios */}
          {!esCliente && (
            <>
              <MenuDesplegable titulo="Gimnasio" items={itemsGimnasio} />

              {gestionaNegocio && <MenuDesplegable titulo="Dinero" items={itemsDinero} />}

              {/* Usuarios es administración del sistema, no es del gimnasio
                  ni del dinero: queda como enlace suelto, solo para el Administrador */}
              {rol === 'Administrador' && (
                <Link to="/usuarios" className="text-slate-300 hover:text-white">
                  Usuarios
                </Link>
              )}
            </>
          )}

          {/* Menú del CLIENTE: sin cambios, son sus accesos personales */}
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
              <Link to="/mi-asistencia" className="text-slate-300 hover:text-white">
                Mi asistencia
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