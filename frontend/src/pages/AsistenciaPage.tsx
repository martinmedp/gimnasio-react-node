import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import TarjetaDato from '../components/TarjetaDato'
import { formatearFechaHora, rangoPreset } from '../utils/formato'

interface Cliente {
  id: number
  nombre: string
  documento: string
  fotoUrl: string | null
}

interface Asistencia {
  id: number
  fecha: string
  cliente: Cliente
  // Datos de las entradas "forzadas" (registradas pese a una advertencia)
  forzada: boolean
  motivoForzada: string | null
  autorizadaPor: { nombre: string } | null
}

interface Contador {
  hoy: number
  semana: number
  mes: number
  total: number
}

// Una advertencia que devuelve el backend cuando una entrada necesita
// confirmación (membresía vencida, doble registro, etc.)
interface Advertencia {
  codigo: string
  mensaje: string
}

// Entrada que está esperando la decisión del personal en el aviso
interface PendienteConfirmar {
  cliente: Cliente
  advertencias: Advertencia[]
}

// Cómo se muestra cada código de motivo en el historial
const ETIQUETA_MOTIVO: Record<string, string> = {
  SIN_MEMBRESIA: 'sin membresía',
  VENCIDA: 'membresía vencida',
  SIN_ENTRADAS: 'sin entradas',
  YA_REGISTRO_HOY: 'ya había entrado hoy',
}

// motivoForzada llega como "VENCIDA,YA_REGISTRO_HOY": lo pasamos a texto legible
function describirMotivo(motivo: string | null): string {
  if (!motivo) return ''
  return motivo
    .split(',')
    .map((codigo) => ETIQUETA_MOTIVO[codigo] ?? codigo)
    .join(', ')
}

function AsistenciaPage() {
  const { notificar } = useNotification()
  const queryClient = useQueryClient()

  const [modo, setModo] = useState<'manual' | 'escaner'>('manual')
  const [documentoBuscado, setDocumentoBuscado] = useState('')
  const [descontarTiquetera, setDescontarTiquetera] = useState(true)
  const [escanerPausado, setEscanerPausado] = useState(false)

  // Si no es null, se muestra el aviso de confirmación
  const [pendienteConfirmar, setPendienteConfirmar] = useState<PendienteConfirmar | null>(null)

  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroClienteId, setFiltroClienteId] = useState('')
  const [soloForzadas, setSoloForzadas] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const escaneando = useRef(false)
  const camaraActiva = useRef(false)

  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: async () => {
      const response = await api.get('/clientes')
      return response.data
    },
  })

  const { data: asistenciasHoy, isLoading: cargandoHoy } = useQuery<Asistencia[]>({
    queryKey: ['asistencias-hoy'],
    queryFn: async () => {
      const response = await api.get('/asistencias/hoy')
      return response.data
    },
  })

  const params: Record<string, string> = {}
  if (filtroDesde && filtroHasta) {
    params.desde = filtroDesde
    params.hasta = filtroHasta
  }
  if (filtroClienteId) params.clienteId = filtroClienteId

  const rangoIncompleto = (filtroDesde !== '') !== (filtroHasta !== '')

  const { data: historial, isLoading: cargandoHistorial, isError: errorHistorial } = useQuery<Asistencia[]>({
    queryKey: ['asistencias-historial', params],
    queryFn: async () => {
      const response = await api.get('/asistencias', { params })
      return response.data
    },
  })

  const { data: contador } = useQuery<Contador>({
    queryKey: ['asistencias-contador', filtroClienteId],
    queryFn: async () => {
      const response = await api.get('/asistencias/contador', {
        params: filtroClienteId ? { clienteId: filtroClienteId } : {},
      })
      return response.data
    },
  })

  const clienteFiltrado = clientes?.find((c) => String(c.id) === filtroClienteId)

  // "Solo forzadas" se filtra aquí, sobre lo que ya llegó del servidor
  const historialMostrado = soloForzadas ? historial?.filter((a) => a.forzada) : historial

  // Arma el mensaje de éxito con el estado de la membresía, para que el
  // mostrador lo vea sin abrir la ficha: entradas que quedan y, si está
  // por vencer, cuántos días faltan
  const armarMensajeExito = (cliente: Cliente, datos: any): string => {
    const { forzada, membresia } = datos
    let texto = `${forzada ? 'Entrada FORZADA registrada' : 'Entrada registrada'}: ${cliente.nombre}`

    if (membresia?.tipo === 'tiquetera' && membresia.entradasRestantes !== null) {
      texto += ` — quedan ${membresia.entradasRestantes} entradas`
    }

    // Si la entrada se forzó, la membresía ya estaba vencida o sin entradas:
    // avisar "vence en N días" no tendría sentido
    const dias = membresia?.diasParaVencer
    if (!forzada && typeof dias === 'number' && dias >= 0 && dias <= 5) {
      texto += dias === 0 ? ' — la membresía vence hoy' : ` — la membresía vence en ${dias} día(s)`
    }

    return texto
  }

  // Envía la entrada al backend. Con confirmar = false, si hay advertencias
  // el backend responde 409 y abrimos el aviso; con confirmar = true se
  // registra aunque las haya (marcada como forzada)
  const enviarEntrada = async (cliente: Cliente, confirmar: boolean) => {
    try {
      const response = await api.post('/asistencias', {
        clienteId: cliente.id,
        descontarTiquetera,
        confirmar,
      })

      notificar(armarMensajeExito(cliente, response.data), response.data.forzada ? 'info' : 'exito')

      queryClient.invalidateQueries({ queryKey: ['asistencias-hoy'] })
      queryClient.invalidateQueries({ queryKey: ['asistencias-historial'] })
      queryClient.invalidateQueries({ queryKey: ['asistencias-contador'] })
    } catch (err: any) {
      // Un 409 con requiereConfirmacion no es un error: es el backend
      // pidiendo una decisión. Mostramos el aviso en vez de un mensaje rojo
      if (err.response?.status === 409 && err.response.data?.requiereConfirmacion) {
        setPendienteConfirmar({ cliente, advertencias: err.response.data.advertencias })
        return
      }
      notificar(err.response?.data?.error || 'Error al registrar la asistencia', 'error')
    }
  }

  const registrarPorDocumento = async (documento: string) => {
    const cliente = clientes?.find((c) => c.documento === documento.trim())

    if (!cliente) {
      notificar(`No se encontró ningún cliente con el documento ${documento}`, 'error')
      return
    }

    await enviarEntrada(cliente, false)
  }

  // El personal decidió registrar la entrada pese a las advertencias
  const handleConfirmarForzada = async () => {
    if (!pendienteConfirmar) return
    const { cliente } = pendienteConfirmar
    // Cerramos el aviso antes de enviar, para evitar un doble clic
    setPendienteConfirmar(null)
    await enviarEntrada(cliente, true)
  }

  const handleBuscarManual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentoBuscado) return
    registrarPorDocumento(documentoBuscado)
    setDocumentoBuscado('')
  }

  const handleEscanearSiguiente = () => {
    setEscanerPausado(false)
  }

  useEffect(() => {
    if (modo !== 'escaner' || escanerPausado) return

    const scanner = new Html5Qrcode('lector-qr')
    scannerRef.current = scanner
    escaneando.current = true

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (textoDecodificado) => {
          if (!escaneando.current) return
          escaneando.current = false

          registrarPorDocumento(textoDecodificado)

          if (camaraActiva.current) {
            camaraActiva.current = false
            scanner
              .stop()
              .then(() => scanner.clear())
              .catch(() => { })
              .finally(() => {
                setEscanerPausado(true)
              })
          } else {
            setEscanerPausado(true)
          }
        },
        () => { }
      )
      .then(() => {
        camaraActiva.current = true
      })
      .catch(() => {
        notificar('No se pudo acceder a la cámara. Revisa los permisos del navegador.', 'error')
      })

    return () => {
      escaneando.current = false
      if (camaraActiva.current) {
        camaraActiva.current = false
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => { })
      }
    }
  }, [modo, escanerPausado])

  const handleCambiarModo = (nuevoModo: 'manual' | 'escaner') => {
    setModo(nuevoModo)
    setEscanerPausado(false)
  }

  const aplicarPresetHistorial = (tipo: 'hoy' | 'semana' | 'mes') => {
    const rango = rangoPreset(tipo)
    setFiltroDesde(rango.desde)
    setFiltroHasta(rango.hasta)
  }

  const limpiarFiltrosHistorial = () => {
    setFiltroDesde('')
    setFiltroHasta('')
    setFiltroClienteId('')
    setSoloForzadas(false)
  }

  // ¿Entre las advertencias está el doble registro? Si es así, avisamos
  // que no se descontará otra entrada de la tiquetera
  const hayDobleRegistro = pendienteConfirmar?.advertencias.some((a) => a.codigo === 'YA_REGISTRO_HOY')

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Registro de asistencia</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleCambiarModo('manual')}
          className={`px-4 py-2 rounded ${modo === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Búsqueda manual
        </button>
        <button
          onClick={() => handleCambiarModo('escaner')}
          className={`px-4 py-2 rounded ${modo === 'escaner' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Escanear QR
        </button>
      </div>

      <label className="flex items-center gap-2 text-white mb-4 text-sm">
        <input
          type="checkbox"
          checked={descontarTiquetera}
          onChange={(e) => setDescontarTiquetera(e.target.checked)}
        />
        Descontar entrada de tiquetera automáticamente (si aplica)
      </label>

      {modo === 'manual' && (
        <form onSubmit={handleBuscarManual} className="flex gap-2 mb-4 max-w-md">
          <input
            type="text"
            placeholder="Documento del cliente"
            value={documentoBuscado}
            onChange={(e) => setDocumentoBuscado(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white flex-1"
            autoFocus
          />
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            Registrar
          </button>
        </form>
      )}

      {modo === 'escaner' && (
        <div className="mb-4 max-w-md">
          <div id="lector-qr" className={`rounded overflow-hidden ${escanerPausado ? 'hidden' : ''}`} />

          {escanerPausado && (
            <div className="bg-slate-800 rounded p-6 text-center">
              <p className="text-slate-300 mb-3">Cámara pausada tras la última captura</p>
              <button
                onClick={handleEscanearSiguiente}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Escanear siguiente
              </button>
            </div>
          )}
        </div>
      )}

      <h2 className="text-xl font-bold text-white mb-3">Asistencias de hoy</h2>
      {cargandoHoy && <p className="text-white">Cargando...</p>}

      {asistenciasHoy && asistenciasHoy.length === 0 && (
        <p className="text-slate-400">Todavía no hay asistencias registradas hoy.</p>
      )}

      <div className="flex flex-col gap-2 max-w-xl mb-10">
        {asistenciasHoy?.map((asistencia) => (
          <div key={asistencia.id} className="bg-slate-800 rounded p-3 flex items-center gap-3">
            {asistencia.cliente.fotoUrl ? (
              <img
                src={`http://localhost:3000${asistencia.cliente.fotoUrl}`}
                alt={asistencia.cliente.nombre}
                className="w-10 h-10 object-cover rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs">
                S/F
              </div>
            )}
            <div className="flex-1">
              <p className="text-white text-sm font-bold">
                {asistencia.cliente.nombre}
                {asistencia.forzada && (
                  <span className="ml-2 bg-orange-600 text-white text-xs font-normal px-2 py-0.5 rounded">
                    Forzada
                  </span>
                )}
              </p>
              <p className="text-slate-400 text-xs">
                {new Date(asistencia.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Historial y contador de entradas ===== */}
      <h2 className="text-xl font-bold text-white mb-3">Historial de asistencias</h2>

      <div className="bg-slate-800 rounded p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => aplicarPresetHistorial('hoy')}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => aplicarPresetHistorial('semana')}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={() => aplicarPresetHistorial('mes')}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Este mes
          </button>
          <button
            type="button"
            onClick={limpiarFiltrosHistorial}
            className="bg-slate-700 text-slate-200 px-3 py-1 rounded hover:bg-slate-600 text-sm"
          >
            Limpiar filtros
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
            <label className="text-slate-400 text-sm block mb-1">Cliente</label>
            <select
              value={filtroClienteId}
              onChange={(e) => setFiltroClienteId(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            >
              <option value="">Todos</option>
              {clientes?.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} ({cliente.documento})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-white text-sm pb-2">
            <input type="checkbox" checked={soloForzadas} onChange={(e) => setSoloForzadas(e.target.checked)} />
            Solo entradas forzadas
          </label>
        </div>

        {rangoIncompleto && (
          <p className="text-yellow-400 text-sm mt-3">
            Completa las dos fechas para filtrar por rango (mientras tanto se ignoran las fechas).
          </p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-white font-bold text-sm mb-1">
          Contador de entradas — {clienteFiltrado ? clienteFiltrado.nombre : 'todo el gimnasio'}
        </h3>
        <p className="text-slate-400 text-xs mb-2">
          Usa periodos fijos (hoy, esta semana, este mes y total) y solo respeta el filtro de cliente.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl">
          <TarjetaDato titulo="Hoy" valor={contador ? String(contador.hoy) : '-'} />
          <TarjetaDato titulo="Esta semana" valor={contador ? String(contador.semana) : '-'} />
          <TarjetaDato titulo="Este mes" valor={contador ? String(contador.mes) : '-'} />
          <TarjetaDato titulo="Total" valor={contador ? String(contador.total) : '-'} />
        </div>
      </div>

      {cargandoHistorial && <p className="text-white">Cargando historial...</p>}
      {errorHistorial && <p className="text-red-400">Error al cargar el historial (revisa el rango de fechas)</p>}

      {historialMostrado && historialMostrado.length === 0 && (
        <p className="text-slate-400">No hay asistencias para estos filtros.</p>
      )}

      {historialMostrado && historialMostrado.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-white text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-2 pr-4">Fecha y hora</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Documento</th>
                <th className="py-2">Observación</th>
              </tr>
            </thead>
            <tbody>
              {historialMostrado.map((asistencia) => (
                <tr key={asistencia.id} className="border-b border-slate-800 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{formatearFechaHora(asistencia.fecha)}</td>
                  <td className="py-2 pr-4">{asistencia.cliente.nombre}</td>
                  <td className="py-2 pr-4">{asistencia.cliente.documento}</td>
                  <td className="py-2">
                    {asistencia.forzada ? (
                      <>
                        <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded">Forzada</span>
                        <span className="block text-slate-400 text-xs mt-1">
                          {describirMotivo(asistencia.motivoForzada)}
                          {asistencia.autorizadaPor ? ` — autorizó ${asistencia.autorizadaPor.nombre}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-slate-400 text-sm mt-2">Entradas en esta selección: {historialMostrado.length}</p>
        </div>
      )}

      {/* Aviso de confirmación: aparece cuando el backend detecta algo
          raro con la entrada. No se cierra al hacer clic fuera, para que
          nadie lo descarte por accidente: hay que elegir una opción */}
      {pendienteConfirmar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 rounded p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-1">Confirmar entrada</h2>
            <p className="text-slate-300 text-sm mb-3">
              {pendienteConfirmar.cliente.nombre} ({pendienteConfirmar.cliente.documento})
            </p>

            <ul className="mb-3 space-y-1">
              {pendienteConfirmar.advertencias.map((advertencia) => (
                <li key={advertencia.codigo} className="text-yellow-300 text-sm">
                  • {advertencia.mensaje}
                </li>
              ))}
            </ul>

            {hayDobleRegistro && (
              <p className="text-slate-400 text-xs mb-3">
                Al ser un segundo registro del día, no se descontará otra entrada de la tiquetera.
              </p>
            )}
            <p className="text-slate-400 text-xs mb-4">
              Si continúas, la entrada quedará marcada como forzada y registrada a tu nombre.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendienteConfirmar(null)}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarForzada}
                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
              >
                Registrar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AsistenciaPage