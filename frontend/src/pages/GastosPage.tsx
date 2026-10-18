import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import TarjetaDato from '../components/TarjetaDato'
import TablaGastos from '../components/TablaGastos'
import { formatearDinero, rangoPreset } from '../utils/formato'
import type { GastoRegistro } from '../types/contabilidad'

interface CategoriaGasto {
  id: number
  nombre: string
}

// Forma de la respuesta de GET /gastos: la lista más un resumen con el
// total de la selección actual (respeta los filtros aplicados)
interface GastosConResumen {
  gastos: GastoRegistro[]
  resumen: { totalGeneral: string; cantidad: number }
}

function GastosPage() {
  const { usuario } = useAuth()
  const { notificar, confirmar } = useNotification()
  const queryClient = useQueryClient()

  const puedeGestionar = usuario?.rol === 'Administrador' || usuario?.rol === 'Recepcionista'

  // Formulario para registrar un gasto. La fecha no se pide: el backend
  // usa el momento en que se registra, igual que con los pagos
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [guardando, setGuardando] = useState(false)

  // Filtros de la lista. Por defecto el mes actual, igual que PagosPage
  const [filtroDesde, setFiltroDesde] = useState(() => rangoPreset('mes').desde)
  const [filtroHasta, setFiltroHasta] = useState(() => rangoPreset('mes').hasta)
  const [filtroCategoriaId, setFiltroCategoriaId] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const rangoCompleto = filtroDesde !== '' && filtroHasta !== ''
  // Solo una de las dos fechas llena: el backend exige ambas juntas
  const rangoIncompleto = (filtroDesde !== '') !== (filtroHasta !== '')

  // Armamos solo los filtros que tienen valor
  const params: Record<string, string> = {}
  if (rangoCompleto) {
    params.desde = filtroDesde
    params.hasta = filtroHasta
  }
  if (filtroCategoriaId) params.categoriaId = filtroCategoriaId
  if (filtroMetodo) params.metodoPago = filtroMetodo
  if (filtroEstado) params.estadoCierre = filtroEstado

  const { data: categorias } = useQuery<CategoriaGasto[]>({
    queryKey: ['categorias-gasto'],
    queryFn: async () => {
      const response = await api.get('/categorias-gasto')
      return response.data
    },
    enabled: puedeGestionar,
  })

  // Los filtros van dentro de la queryKey: cada vez que cambian, TanStack
  // Query entiende que es otra consulta y vuelve a pedir los datos solo
  const { data, isLoading, isError } = useQuery<GastosConResumen>({
    queryKey: ['gastos', params],
    queryFn: async () => {
      const response = await api.get('/gastos', { params })
      return response.data
    },
    enabled: puedeGestionar,
  })

  const montoValido = monto !== '' && !isNaN(Number(monto)) && Number(monto) > 0

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!categoriaId) {
      notificar('Selecciona una categoría', 'error')
      return
    }
    if (!descripcion.trim()) {
      notificar('La descripción es obligatoria', 'error')
      return
    }
    if (!montoValido) {
      notificar('El monto debe ser un número mayor a 0', 'error')
      return
    }

    setGuardando(true)
    try {
      await api.post('/gastos', { categoriaId, descripcion: descripcion.trim(), monto, metodoPago })
      setCategoriaId('')
      setDescripcion('')
      setMonto('')
      setMetodoPago('efectivo')
      queryClient.invalidateQueries({ queryKey: ['gastos'] })
      notificar('Gasto registrado correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al registrar el gasto', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (gasto: GastoRegistro) => {
    const confirmado = await confirmar(
      `¿Eliminar este gasto de ${formatearDinero(gasto.monto)} (${gasto.categoria.nombre})?`,
      { variante: 'peligro', textoAceptar: 'Eliminar' }
    )
    if (!confirmado) return

    try {
      await api.delete(`/gastos/${gasto.id}`)
      queryClient.invalidateQueries({ queryKey: ['gastos'] })
      notificar('Gasto eliminado', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al eliminar el gasto', 'error')
    }
  }

  const aplicarPreset = (tipo: 'hoy' | 'semana' | 'mes') => {
    const rango = rangoPreset(tipo)
    setFiltroDesde(rango.desde)
    setFiltroHasta(rango.hasta)
  }

  const verTodoElHistorial = () => {
    setFiltroDesde('')
    setFiltroHasta('')
  }

  // Todos los hooks ya se llamaron arriba; este return anticipado es seguro
  if (!puedeGestionar) {
    return <p className="text-red-400">No tienes acceso a esta sección.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gastos</h1>

      {/* ===== Registrar un gasto ===== */}
      <form onSubmit={handleRegistrar} className="grid grid-cols-3 gap-2 mb-8 bg-slate-800 p-4 rounded max-w-3xl">
        <h2 className="text-white font-bold col-span-3">Registrar gasto</h2>

        {categorias && categorias.length === 0 && (
          <p className="text-yellow-400 text-sm col-span-3">
            Todavía no hay categorías.{' '}
            <Link to="/categorias-gasto" className="underline">
              Crea la primera aquí
            </Link>
            .
          </p>
        )}

        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white"
        >
          <option value="">Selecciona una categoría</option>
          {categorias?.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <select
          value={metodoPago}
          onChange={(e) => setMetodoPago(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white"
        >
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option>
        </select>
        <textarea
          placeholder="Descripción: qué se compró o pagó, tienda, número de factura..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="col-span-3 p-2 rounded bg-slate-700 text-white"
        />
        <button
          type="submit"
          disabled={guardando}
          className="col-span-3 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Registrar gasto'}
        </button>
      </form>

      {/* ===== Filtros ===== */}
      <h2 className="text-xl font-bold text-white mb-3">Historial de gastos</h2>

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
              value={filtroDesde}
              onChange={(e) => setFiltroDesde(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Hasta</label>
            <input
              type="date"
              value={filtroHasta}
              onChange={(e) => setFiltroHasta(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Categoría</label>
            <select
              value={filtroCategoriaId}
              onChange={(e) => setFiltroCategoriaId(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            >
              <option value="">Todas</option>
              {categorias?.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Método</label>
            <select
              value={filtroMetodo}
              onChange={(e) => setFiltroMetodo(e.target.value)}
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
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
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
          No se pudieron cargar los gastos. Revisa que la fecha "desde" no sea posterior a "hasta".
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
            <TarjetaDato titulo="Total de gastos" valor={formatearDinero(data.resumen.totalGeneral)} />
            <TarjetaDato titulo="Cantidad de gastos" valor={String(data.resumen.cantidad)} />
          </div>

          <TablaGastos gastos={data.gastos} mostrarCierre onEliminar={handleEliminar} />
        </>
      )}
    </div>
  )
}

export default GastosPage