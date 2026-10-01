import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
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
}

function AsistenciaPage() {
  const { notificar } = useNotification()
  const queryClient = useQueryClient()

  const [modo, setModo] = useState<'manual' | 'escaner'>('manual')
  const [documentoBuscado, setDocumentoBuscado] = useState('')
  const [descontarTiquetera, setDescontarTiquetera] = useState(true)
  const [escanerPausado, setEscanerPausado] = useState(false)

  // Filtros del historial. Vacíos por defecto: sin fechas se interpreta
  // como "sin filtrar por fecha", igual que ya hace PagosPage con "todo el historial"
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroClienteId, setFiltroClienteId] = useState('')

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

  // Armamos los filtros solo con lo que tenga valor, igual que en PagosPage
  const params: Record<string, string> = {}
  if (filtroDesde && filtroHasta) {
    params.desde = filtroDesde
    params.hasta = filtroHasta
  }
  if (filtroClienteId) params.clienteId = filtroClienteId

  const rangoIncompleto = (filtroDesde !== '') !== (filtroHasta !== '')

  // El historial filtrado es una consulta aparte de "asistencias de hoy":
  // esta sí cambia según los filtros (va en la queryKey), mientras que
  // la de arriba siempre muestra el día actual sin importar los filtros
  const { data: historial, isLoading: cargandoHistorial, isError: errorHistorial } = useQuery<Asistencia[]>({
    queryKey: ['asistencias-historial', params],
    queryFn: async () => {
      const response = await api.get('/asistencias', { params })
      return response.data
    },
  })

  const registrarPorDocumento = async (documento: string) => {
    const cliente = clientes?.find((c) => c.documento === documento.trim())

    if (!cliente) {
      notificar(`No se encontró ningún cliente con el documento ${documento}`, 'error')
      return
    }

    try {
      const response = await api.post('/asistencias', {
        clienteId: cliente.id,
        descontarTiquetera,
      })

      const { descontoTiquetera, entradasRestantes } = response.data
      let texto = `Entrada registrada: ${cliente.nombre}`
      if (descontoTiquetera) {
        texto += ` (tiquetera: quedan ${entradasRestantes} entradas)`
      }
      notificar(texto, 'exito')

      queryClient.invalidateQueries({ queryKey: ['asistencias-hoy'] })
      // El historial también puede incluir el día de hoy, así que lo
      // refrescamos para que la nueva asistencia aparezca ahí también
      queryClient.invalidateQueries({ queryKey: ['asistencias-historial'] })
    } catch (err) {
      notificar('Error al registrar la asistencia', 'error')
    }
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
  }

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
              <p className="text-white text-sm font-bold">{asistencia.cliente.nombre}</p>
              <p className="text-slate-400 text-xs">
                {new Date(asistencia.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Historial por rango de fechas y/o cliente ===== */}
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
        </div>

        {rangoIncompleto && (
          <p className="text-yellow-400 text-sm mt-3">
            Completa las dos fechas para filtrar por rango (mientras tanto se ignoran las fechas).
          </p>
        )}
      </div>

      {cargandoHistorial && <p className="text-white">Cargando historial...</p>}
      {errorHistorial && <p className="text-red-400">Error al cargar el historial (revisa el rango de fechas)</p>}

      {historial && historial.length === 0 && (
        <p className="text-slate-400">No hay asistencias para estos filtros.</p>
      )}

      {historial && historial.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-white text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-2 pr-4">Fecha y hora</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2">Documento</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((asistencia) => (
                <tr key={asistencia.id} className="border-b border-slate-800">
                  <td className="py-2 pr-4 whitespace-nowrap">{formatearFechaHora(asistencia.fecha)}</td>
                  <td className="py-2 pr-4">{asistencia.cliente.nombre}</td>
                  <td className="py-2">{asistencia.cliente.documento}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-slate-400 text-sm mt-2">Total: {historial.length} asistencia(s)</p>
        </div>
      )}
    </div>
  )
}

export default AsistenciaPage