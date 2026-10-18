import { useAuth } from '../context/AuthContext'
import DashboardFinanzas from '../components/DashboardFinanzas'
import DashboardAsistencia from '../components/DashboardAsistencia'

function DashboardPage() {
  const { usuario } = useAuth()
  const esAdministrador = usuario?.rol === 'Administrador'

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">
        {esAdministrador ? 'Panel de control' : 'Bienvenido'}
      </h1>

      {/* Las estadísticas son solo del Administrador (el backend también
          lo exige). Los demás roles ven el saludo de siempre */}
      {esAdministrador ? (
        <>
          <DashboardFinanzas />
          <div className="mt-10">
            <DashboardAsistencia />
          </div>
        </>
      ) : (
        <p className="text-slate-300">Selecciona una sección del menú para comenzar.</p>
      )}
    </div>
  )
}

export default DashboardPage