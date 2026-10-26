import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import { abrirPdf } from '../utils/descargarPdf'
import { formatearFecha } from '../utils/formato'

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
  // null = todavía no está en ningún cierre de caja
  cierreCajaId: number | null
  registradoPor: { nombre: string }
  // Datos de la anulación (el pago no se borra, queda marcado)
  anulado: boolean
  anuladoEn: string | null
  motivoAnulacion: string | null
  anuladoPor?: { nombre: string } | null
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
  // Anular un pago es exclusivo del Administrador
  const esAdministrador = usuario?.rol === 'Administrador'

  const [planSeleccionado, setPlanSeleccionado] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')

  // Estado de la ventana de anulación: el pago que se va a anular
  // (null = ventana cerrada) y lo que se escribe en ella
  const [pagoAAnular, setPagoAAnular] = useState<Pago | null>(null)
  const [passwordAnular, setPasswordAnular] = useState('')
  const [motivoAnular, setMotivoAnular] = useState('')
  const [anulando, setAnulando] = useState(false)

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
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al registrar el pago', 'error')
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

  const abrirModalAnulacion = (pago: Pago) => {
    setPagoAAnular(pago)
    setPasswordAnular('')
    setMotivoAnular('')
  }

  const handleConfirmarAnulacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pagoAAnular) return

    if (!passwordAnular) {
      notificar('Debes ingresar tu contraseña', 'error')
      return
    }
    if (!motivoAnular.trim()) {
      notificar('Debes indicar el motivo de la anulación', 'error')
      return
    }

    setAnulando(true)
    try {
      await api.post(`/pagos/${pagoAAnular.id}/anular`, {
        password: passwordAnular,
        motivo: motivoAnular,
      })

      notificar('Pago anulado. La membresía quedó sin pago válido: ya puedes registrar el correcto.', 'exito')
      setPagoAAnular(null)

      // Un pago anulado cambia los totales de varias pantallas
      queryClient.invalidateQueries({ queryKey: ['membresias', id] })
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      queryClient.invalidateQueries({ queryKey: ['estadisticas-finanzas'] })
    } catch (err: any) {
      // Si la contraseña es incorrecta, el aviso sale y la ventana queda
      // abierta para corregir sin perder lo que ya escribiste
      notificar(err.response?.data?.error || 'Error al anular el pago', 'error')
    } finally {
      setAnulando(false)
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
        {membresias?.map((membresia) => {
          // El personal ve todos los pagos (los anulados también, como
          // rastro). El Cliente solo los válidos, aunque el backend ya
          // no debería enviarle los anulados
          const pagosVisibles = puedeGestionar ? membresia.pagos : membresia.pagos.filter((p) => !p.anulado)
          // ¿Tiene al menos un pago que no esté anulado?
          const tienePagoValido = membresia.pagos.some((p) => !p.anulado)

          return (
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

                {pagosVisibles.length === 0 ? (
                  <p className="text-slate-500 text-sm">Sin pagos registrados.</p>
                ) : (
                  <ul className="text-sm text-slate-300 mb-2">
                    {pagosVisibles.map((pago) => (
                      <li key={pago.id} className={`py-1 ${pago.anulado ? 'opacity-70' : ''}`}>
                        <div className="flex items-center justify-between gap-3">
                          {/* Un pago anulado se ve tachado */}
                          <span className={pago.anulado ? 'line-through' : ''}>
                            ${formatearPrecio(pago.monto)} — {pago.metodoPago} — {formatearFecha(pago.fecha)}
                            <span className="text-slate-500"> — atendido por {pago.registradoPor.nombre}</span>
                          </span>

                          <span className="flex items-center gap-2">
                            {pago.anulado && (
                              <span className="bg-red-700 text-white text-xs px-2 py-0.5 rounded">Anulado</span>
                            )}

                            {/* El recibo lo genera el personal; el de un pago
                                anulado sale marcado como ANULADO */}
                            {puedeGestionar && (
                              <button
                                onClick={() => abrirPdf(`/pagos/${pago.id}/recibo`)}
                                className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-xs whitespace-nowrap"
                              >
                                Recibo PDF
                              </button>
                            )}

                            {/* Anular: solo el Administrador, y solo si el pago
                                no está anulado. Si ya está en un cierre, hay que
                                revertir el cierre antes */}
                            {esAdministrador &&
                              !pago.anulado &&
                              (pago.cierreCajaId ? (
                                <span className="text-slate-500 text-xs whitespace-nowrap">
                                  En cierre #{pago.cierreCajaId}
                                </span>
                              ) : (
                                <button
                                  onClick={() => abrirModalAnulacion(pago)}
                                  className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800 text-xs"
                                >
                                  Anular
                                </button>
                              ))}
                          </span>
                        </div>

                        {/* Detalle de la anulación, solo para el personal */}
                        {pago.anulado && puedeGestionar && (
                          <p className="text-red-300 text-xs mt-1">
                            Anulado{pago.anuladoEn ? ` el ${formatearFecha(pago.anuladoEn)}` : ''}
                            {pago.anuladoPor ? ` por ${pago.anuladoPor.nombre}` : ''}
                            {pago.motivoAnulacion ? `. Motivo: ${pago.motivoAnulacion}` : ''}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Aviso para el personal: hay pagos, pero ninguno es válido */}
                {puedeGestionar && membresia.pagos.length > 0 && !tienePagoValido && (
                  <p className="text-yellow-400 text-xs mb-2">Esta membresía no tiene un pago válido.</p>
                )}

                {/* Registrar pago: solo si no hay ningún pago válido (los
                    anulados no cuentan, así se puede cargar el correcto) */}
                {puedeGestionar && !tienePagoValido && (
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
          )
        })}
      </div>

      {/* Ventana de anulación: pide motivo y contraseña. No se cierra al
          hacer clic fuera, para no perder lo escrito por accidente */}
      {pagoAAnular && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <form onSubmit={handleConfirmarAnulacion} className="bg-slate-800 rounded p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-2">Anular pago</h2>
            <p className="text-slate-300 text-sm mb-1">
              ${formatearPrecio(pagoAAnular.monto)} — {pagoAAnular.metodoPago} — {formatearFecha(pagoAAnular.fecha)}
            </p>
            <p className="text-slate-400 text-xs mb-4">
              El pago dejará de contar en totales, cierres y reportes, y su recibo saldrá marcado como anulado. No se
              borra: queda registrado. La membresía seguirá activa y podrás registrar el pago correcto. Esta acción
              requiere tu contraseña de Administrador.
            </p>

            <label className="text-slate-400 text-sm block mb-1">Tu contraseña</label>
            <input
              type="password"
              value={passwordAnular}
              onChange={(e) => setPasswordAnular(e.target.value)}
              className="w-full p-2 rounded bg-slate-700 text-white mb-3"
              autoFocus
            />

            <label className="text-slate-400 text-sm block mb-1">Motivo de la anulación</label>
            <textarea
              value={motivoAnular}
              onChange={(e) => setMotivoAnular(e.target.value)}
              rows={3}
              placeholder="Ej: se registró con el método equivocado, el cliente pagó otro plan, etc."
              className="w-full p-2 rounded bg-slate-700 text-white mb-4"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPagoAAnular(null)}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={anulando}
                className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800 disabled:opacity-50"
              >
                {anulando ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default MembresiaPage