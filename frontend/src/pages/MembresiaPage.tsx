import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'

interface Cliente {
  id: number
  nombre: string
  documento: string
}

interface Plan {
  id: number
  nombre: string
  tipo: string
  precio: string
}

interface Pago {
  id: number
  monto: string
  fecha: string
  metodoPago: string
  registradoPor: { nombre: string }
}

interface Membresia {
  id: number
  fechaInicio: string
  fechaFin: string | null
  entradasRestantes: number | null
  estado: string
  alerta: 'proxima' | 'vencida' | null
  plan: Plan
  pagos: Pago[]
}

function MembresiaPage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const { notificar } = useNotification()
  const queryClient = useQueryClient()

  const puedeGestionar = usuario?.rol === 'Administrador' || usuario?.rol === 'Recepcionista'

  const [planSeleccionado, setPlanSeleccionado] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')

  const { data: cliente } = useQuery<Cliente>({
    queryKey: ['cliente', id],
    queryFn: async () => {
      const response = await api.get(`/clientes/${id}`)
      return response.data
    },
  })

  const { data: membresias, isLoading, isError } = useQuery<Membresia[]>({
    queryKey: ['membresias', id],
    queryFn: async () => {
      const response = await api.get(`/membresias/cliente/${id}`)
      return response.data
    },
  })

  const { data: planes } = useQuery<Plan[]>({
    queryKey: ['planes'],
    queryFn: async () => {
      const response = await api.get('/planes')
      return response.data
    },
    enabled: puedeGestionar,
  })

  const handleInscribir = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planSeleccionado) {
      notificar('Selecciona un plan', 'error')
      return
    }

    try {
      await api.post('/membresias', { clienteId: id, planId: planSeleccionado })
      setPlanSeleccionado('')
      queryClient.invalidateQueries({ queryKey: ['membresias', id] })
      notificar('Membresía inscrita correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al inscribir la membresía', 'error')
    }
  }

  const handleRegistrarPago = async (membresiaId: number) => {
    try {
      await api.post(`/membresias/${membresiaId}/pagos`, { metodoPago })
      queryClient.invalidateQueries({ queryKey: ['membresias', id] })
      notificar('Pago registrado correctamente', 'exito')
    } catch (err) {
      notificar('Error al registrar el pago', 'error')
    }
  }

  const handleCambiarEstado = async (membresiaId: number, nuevoEstado: string) => {
    try {
      await api.put(`/membresias/${membresiaId}/estado`, { estado: nuevoEstado })
      queryClient.invalidateQueries({ queryKey: ['membresias', id] })
      notificar(`Membresía marcada como ${nuevoEstado}`, 'exito')
    } catch (err) {
      notificar('Error al cambiar el estado', 'error')
    }
  }

  const formatearPrecio = (precio: string) => Number(precio).toLocaleString('es-CO')

  const renderAlerta = (alerta: Membresia['alerta']) => {
    if (alerta === 'vencida') return <span className="bg-red-600 text-xs px-2 py-1 rounded ml-2">Vencida</span>
    if (alerta === 'proxima') return <span className="bg-yellow-600 text-xs px-2 py-1 rounded ml-2">Próxima a vencer</span>
    return null
  }

  return (
    <div>
      {puedeGestionar && (
        <Link to="/clientes" className="text-slate-400 hover:text-white text-sm mb-4 inline-block">
          ← Volver a clientes
        </Link>
      )}

      <h1 className="text-3xl font-bold text-white mb-1">
        {puedeGestionar ? `Membresía de ${cliente ? cliente.nombre : 'Cargando...'}` : 'Mi membresía'}
      </h1>
      {cliente && puedeGestionar && <p className="text-slate-400 mb-6">Documento: {cliente.documento}</p>}

      {puedeGestionar && (
        <form onSubmit={handleInscribir} className="flex gap-2 mb-8 bg-slate-800 p-4 rounded max-w-2xl">
          <select
            value={planSeleccionado}
            onChange={(e) => setPlanSeleccionado(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white flex-1"
          >
            <option value="">Selecciona un plan para inscribir</option>
            {planes?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nombre} — ${formatearPrecio(plan.precio)}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            Inscribir
          </button>
        </form>
      )}

      {isLoading && <p className="text-white">Cargando historial...</p>}
      {isError && <p className="text-red-400">Error al cargar las membresías</p>}

      {membresias && membresias.length === 0 && (
        <p className="text-slate-400">
          {puedeGestionar ? 'Este cliente no tiene membresías registradas.' : 'Todavía no tienes ninguna membresía registrada.'}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {membresias?.map((membresia) => (
          <div key={membresia.id} className="bg-slate-800 rounded p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-white font-bold text-lg">{membresia.plan.nombre}</span>
                <span className="text-slate-400 text-sm capitalize ml-2">({membresia.plan.tipo})</span>
                {renderAlerta(membresia.alerta)}
                <p className="text-slate-400 text-sm mt-1">
                  Inicio: {membresia.fechaInicio.substring(0, 10)}
                  {membresia.fechaFin && ` — Vence: ${membresia.fechaFin.substring(0, 10)}`}
                </p>
                {membresia.entradasRestantes !== null && (
                  <p className="text-slate-400 text-sm">Entradas restantes: {membresia.entradasRestantes}</p>
                )}
                <p className="text-white text-sm mt-1">
                  Estado: <span className="capitalize font-bold">{membresia.estado}</span>
                </p>
              </div>

              {puedeGestionar && membresia.estado === 'activa' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCambiarEstado(membresia.id, 'vencida')}
                    className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-xs"
                  >
                    Marcar vencida
                  </button>
                  <button
                    onClick={() => handleCambiarEstado(membresia.id, 'cancelada')}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-700 pt-3 mt-2">
              <p className="text-slate-400 text-sm font-bold mb-1">Pagos:</p>
              {membresia.pagos.length === 0 ? (
                <p className="text-slate-500 text-sm">Sin pagos registrados.</p>
              ) : (
                <ul className="text-sm text-slate-300 mb-2">
                  {membresia.pagos.map((pago) => (
                    <li key={pago.id}>
                      ${formatearPrecio(pago.monto)} — {pago.metodoPago} — {pago.fecha.substring(0, 10)}
                      <span className="text-slate-500"> — atendido por {pago.registradoPor.nombre}</span>
                    </li>
                  ))}
                </ul>
              )}

              {puedeGestionar && membresia.pagos.length === 0 && (
                <div className="flex gap-2 items-center">
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="p-1 rounded bg-slate-700 text-white text-sm"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                  <button
                    onClick={() => handleRegistrarPago(membresia.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                  >
                    Registrar pago (${formatearPrecio(membresia.plan.precio)})
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MembresiaPage