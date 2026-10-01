import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import TarjetaDato from '../components/TarjetaDato'
import TablaPagos, { ChipsMetodo } from '../components/TablaPagos'
import { formatearDinero, rangoPreset } from '../utils/formato'
import type { PagosConResumen } from '../types/contabilidad'

function PagosPage() {
  const { usuario } = useAuth()
  const puedeVer = usuario?.rol === 'Administrador' || usuario?.rol === 'Recepcionista'

  // Por defecto mostramos el mes actual, para no traer todo el historial
  // de pagos (que crece con el tiempo). La función dentro de useState solo
  // se ejecuta la primera vez que se muestra la pantalla
  const [desde, setDesde] = useState(() => rangoPreset('mes').desde)
  const [hasta, setHasta] = useState(() => rangoPreset('mes').hasta)
  const [metodoPago, setMetodoPago] = useState('')
  const [estadoCierre, setEstadoCierre] = useState('')

  const rangoCompleto = desde !== '' && hasta !== ''
  // Solo una de las dos fechas llena: el backend exige ambas juntas
  const rangoIncompleto = (desde !== '') !== (hasta !== '')

  // Armamos los filtros que se envían al backend: solo los que tienen valor
  const params: Record<string, string> = {}
  if (rangoCompleto) {
    params.desde = desde
    params.hasta = hasta
  }
  if (metodoPago) params.metodoPago = metodoPago
  if (estadoCierre) params.estadoCierre = estadoCierre

  // Los filtros van dentro de la queryKey: cada vez que cambian, TanStack
  // Query entiende que es otra consulta y vuelve a pedir los datos solo
  const { data, isLoading, isError } = useQuery<PagosConResumen>({
    queryKey: ['pagos', params],
    queryFn: async () => {
      const response = await api.get('/pagos', { params })
      return response.data
    },
    enabled: puedeVer,
  })

  const aplicarPreset = (tipo: 'hoy' | 'semana' | 'mes') => {
    const rango = rangoPreset(tipo)
    setDesde(rango.desde)
    setHasta(rango.hasta)
  }

  const verTodoElHistorial = () => {
    setDesde('')
    setHasta('')
  }

  // Todos los hooks ya se llamaron arriba; este return anticipado es seguro
  if (!puedeVer) {
    return <p className="text-red-400">No tienes acceso a esta sección.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Registro de pagos</h1>

      {/* Filtros */}
      <div className="bg-slate-800 rounded p-4 mb-6">
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
            onClick={verTodoElHistorial}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Todo el historial
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
          <div>
            <label className="text-slate-400 text-sm block mb-1">Método</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            >
              <option value="">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Estado</label>
            <select
              value={estadoCierre}
              onChange={(e) => setEstadoCierre(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendientes de cierre</option>
              <option value="cerrado">Ya cerrados</option>
            </select>
          </div>
        </div>

        {rangoIncompleto && (
          <p className="text-yellow-400 text-sm mt-3">
            Completa las dos fechas para filtrar por rango (mientras tanto se ignoran las fechas).
          </p>
        )}
      </div>

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && (
        <p className="text-red-400">
          No se pudieron cargar los pagos. Revisa que la fecha "desde" no sea posterior a "hasta".
        </p>
      )}

      {data && (
        <>
          {/* Totales de la selección actual (respetan los filtros aplicados) */}
          <div className="grid grid-cols-3 gap-3 mb-3 max-w-2xl">
            <TarjetaDato titulo="Total general" valor={formatearDinero(data.resumen.totalGeneral)} />
            <TarjetaDato titulo="Total en efectivo" valor={formatearDinero(data.resumen.totalEfectivo)} />
            <TarjetaDato titulo="Cantidad de pagos" valor={String(data.resumen.cantidad)} />
          </div>
          <div className="mb-6">
            <ChipsMetodo porMetodo={data.resumen.porMetodo} />
          </div>

          <TablaPagos pagos={data.pagos} mostrarCierre />
        </>
      )}
    </div>
  )
}

export default PagosPage