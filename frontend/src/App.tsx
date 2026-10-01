import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
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
import PlanesPage from './pages/PlanesPage'
import MembresiaPage from './pages/MembresiaPage'
import AsistenciaPage from './pages/AsistenciaPage'
import EntrenadoresPage from './pages/EntrenadoresPage'
import PagosPage from './pages/PagosPage'
import CierresPage from './pages/CierresPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroClientePage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/:id/medidas" element={<MedidasPage />} />
          <Route path="/clientes/:id/rutinas" element={<RutinasPage />} />
          <Route path="/clientes/:id/membresia" element={<MembresiaPage />} />
          <Route path="/ejercicios" element={<EjerciciosPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/mi-perfil" element={<MiPerfilPage />} />
          <Route path="/planes" element={<PlanesPage />} />
          <Route path="/asistencia" element={<AsistenciaPage />} />
          <Route path="/entrenadores" element={<EntrenadoresPage />} />
          <Route path="/pagos" element={<PagosPage />} />
          <Route path="/cierres" element={<CierresPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App