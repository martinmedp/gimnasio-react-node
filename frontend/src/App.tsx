import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import RutaPorRol from './components/RutaPorRol'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegistroClientePage from './pages/RegistroClientePage'
import DashboardPage from './pages/DashboardPage'
import ClientesPage from './pages/ClientesPage'
import MedidasPage from './pages/MedidasPage'
import EjerciciosPage from './pages/EjerciciosPage'
import RutinasPage from './pages/RutinasPage'
import UsuariosPage from './pages/UsuariosPage'
import MiPerfilPage from './pages/MiPerfilPage'
import MiAsistenciaPage from './pages/MiAsistenciaPage'
import PlanesPage from './pages/PlanesPage'
import MembresiaPage from './pages/MembresiaPage'
import AsistenciaPage from './pages/AsistenciaPage'
import EntrenadoresPage from './pages/EntrenadoresPage'
import PagosPage from './pages/PagosPage'
import GastosPage from './pages/GastosPage'
import CategoriasGastoPage from './pages/CategoriasGastoPage'
import CierresPage from './pages/CierresPage'

// Grupos de roles reutilizados en varias rutas. Reflejan la matriz de
// permisos del backend y el menú de navegación
const PERSONAL = ['Administrador', 'Recepcionista', 'Entrenador']
const ADMIN_Y_RECEPCION = ['Administrador', 'Recepcionista']
const TODOS = ['Administrador', 'Recepcionista', 'Entrenador', 'Cliente']

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroClientePage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* La página principal la ven todos (cada rol ve lo suyo) */}
          <Route path="/" element={<DashboardPage />} />

          {/* Solo personal */}
          <Route element={<RutaPorRol roles={PERSONAL} />}>
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/ejercicios" element={<EjerciciosPage />} />
          </Route>

          {/* Administrador y Recepcionista: lo comercial y el dinero */}
          <Route element={<RutaPorRol roles={ADMIN_Y_RECEPCION} />}>
            <Route path="/planes" element={<PlanesPage />} />
            <Route path="/asistencia" element={<AsistenciaPage />} />
            <Route path="/pagos" element={<PagosPage />} />
            <Route path="/gastos" element={<GastosPage />} />
            <Route path="/categorias-gasto" element={<CategoriasGastoPage />} />
            <Route path="/cierres" element={<CierresPage />} />
          </Route>

          {/* Solo Administrador */}
          <Route element={<RutaPorRol roles={['Administrador']} />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>

          {/* Pantallas por cliente: cada una la ven los roles con permiso
              (el Cliente solo accede a las suyas; eso lo garantiza el backend) */}
          <Route element={<RutaPorRol roles={['Administrador', 'Entrenador', 'Cliente']} />}>
            <Route path="/clientes/:id/medidas" element={<MedidasPage />} />
          </Route>
          <Route element={<RutaPorRol roles={TODOS} />}>
            <Route path="/clientes/:id/rutinas" element={<RutinasPage />} />
            <Route path="/entrenadores" element={<EntrenadoresPage />} />
          </Route>
          <Route element={<RutaPorRol roles={['Administrador', 'Recepcionista', 'Cliente']} />}>
            <Route path="/clientes/:id/membresia" element={<MembresiaPage />} />
          </Route>

          {/* Solo Cliente: sus accesos personales */}
          <Route element={<RutaPorRol roles={['Cliente']} />}>
            <Route path="/mi-perfil" element={<MiPerfilPage />} />
            <Route path="/mi-asistencia" element={<MiAsistenciaPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App