import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClientesPage from './pages/ClientesPage'
import MedidasPage from './pages/MedidasPage'
import EjerciciosPage from './pages/EjerciciosPage'
import RutinasPage from './pages/RutinasPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/:id/medidas" element={<MedidasPage />} />
          <Route path="/clientes/:id/rutinas" element={<RutinasPage />} />
          <Route path="/ejercicios" element={<EjerciciosPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App