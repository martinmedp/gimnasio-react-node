import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import TarjetaDato from '../components/TarjetaDato'
import { formatearFechaHora, rangoPreset } from '../utils/formato'

// Desde el punto de vista del cliente, una asistencia es solo una fecha
// y hora: el endpoint por cliente no trae datos de otras personas
interface Asistencia {
  id: number
  fecha: string
}

interface Contador {
  hoy: number
  semana: number
  mes: number
  total: number
}

function MiAsistenciaPage() {
  const { usuario } = useAuth()

  // El id sale de la sesión, nunca de la URL: un cliente no puede pedir
  // el registro de otro (y el backend además lo rechazaría con un 403)
  const clienteId = usuario?.clienteId

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Solo enviamos las fechas si están completas las dos: el backend las
  // exige juntas
  const params: Record<string, string> = {}
  if (desde && hasta) {
    params.desde = desde
    params.hasta = hasta
  }
  const rangoIncompleto = (desde !== '') !== (hasta !== '')

  // enabled: no se pide nada hasta que exista un clienteId (por ejemplo,
  // si un usuario de personal entrara a esta dirección por error)
  const { data: contador } = useQuery<Contador>({
    queryKey: ['asistencias-contador-cliente', clienteId],
    queryFn: async () => {
      const response = await api.get(`/asistencias/cliente/${clienteId}/contador`)
      return response.data
    },
    enabled: !!clienteId,
  })

  const { data: historial, isLoading, isError } = useQuery<Asistencia[]>({
    queryKey: ['asistencias-cliente', clienteId, params],
    queryFn: async () => {
      const response = await api.get(`/asistencias/cliente/${clienteId}`, { params })
      return response.data
    },
    enabled: !!clienteId,
  })

  const aplicarPreset = (tipo: 'hoy' | 'semana' | 'mes') => {
    const rango = rangoPreset(tipo)
    setDesde(rango.desde)
    setHasta(rango.hasta)
  }

  const verTodo = () => {
    setDesde('')
    setHasta('')
  }

  // Todos los hooks ya se llamaron arriba; este return anticipado es seguro
  if (!clienteId) {
    return <p className="text-red-400">Esta sección es solo para clientes.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Mi asistencia</h1>

      {/* Contador: periodos fijos calculados por el servidor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 max-w-2xl">
        <TarjetaDato titulo="Hoy" valor={contador ? String(contador.hoy) : '-'} />
        <TarjetaDato titulo="Esta semana" valor={contador ? String(contador.semana) : '-'} />
        <TarjetaDato titulo="Este mes" valor={contador ? String(contador.mes) : '-'} />
        <TarjetaDato titulo="Total" valor={contador ? String(contador.total) : '-'} />
      </div>

      <h2 className="text-xl font-bold text-white mb-3">Mis entradas</h2>

      <div className="bg-slate-800 rounded p-4 mb-6 max-w-2xl">
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => aplicarPreset('hoy')}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => aplicarPreset('semana')}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={() => aplicarPreset('mes')}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Este mes
          </button>
          <button
            type="button"
            onClick={verTodo}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Todo
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />
          </div>
        </div>

        {rangoIncompleto && (
          <p className="text-yellow-400 text-sm mt-3">
            Completa las dos fechas para filtrar por rango (mientras tanto se ignoran).
          </p>
        )}
      </div>

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar tus entradas (revisa el rango de fechas)</p>}

      {historial && historial.length === 0 && (
        <p className="text-slate-400">No tienes entradas registradas en este periodo.</p>
      )}

      {historial && historial.length > 0 && (
        <div className="max-w-2xl">
          <table className="w-full text-left text-white text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-2 pr-4">#</th>
                <th className="py-2">Fecha y hora</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((asistencia, indice) => (
                <tr key={asistencia.id} className="border-b border-slate-800">
                  {/* Numeramos de más reciente a más antigua, sin usar el id
                      de la base (que no significa nada para el cliente) */}
                  <td className="py-2 pr-4 text-slate-400">{historial.length - indice}</td>
                  <td className="py-2 whitespace-nowrap">{formatearFechaHora(asistencia.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-slate-400 text-sm mt-2">Entradas en esta selección: {historial.length}</p>
        </div>
      )}
    </div>
  )
}

export default MiAsistenciaPage