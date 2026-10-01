import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import TarjetaDato from '../components/TarjetaDato'
import TablaPagos, { ChipsMetodo } from '../components/TablaPagos'
import {
  estiloDiferencia,
  formatearDinero,
  formatearFecha,
  formatearFechaHora,
  formatearFechaInput,
  rangoPreset,
} from '../utils/formato'
import type { PagoRegistro, PagosConResumen, Resumen } from '../types/contabilidad'

interface Cierre {
  id: number
  fechaDesde: string
  fechaHasta: string
  totalGeneral: string
  totalEfectivo: string
  efectivoContado: string
  diferencia: string
  observaciones: string | null
  fechaCierre: string
  cerradoPor: { nombre: string }
}

interface CierreListado extends Cierre {
  _count: { pagos: number }
}

interface CierreDetalle extends Cierre {
  pagos: PagoRegistro[]
  desglose: Resumen
}

interface CierreCreado {
  id: number
  totalGeneral: string
  totalEfectivo: string
  efectivoContado: string
  diferencia: string
}

function textoPeriodo(desdeIso: string, hastaIso: string): string {
  const desde = formatearFecha(desdeIso)
  const hasta = formatearFecha(hastaIso)
  return desde === hasta ? desde : `${desde} – ${hasta}`
}

function CierresPage() {
  const { usuario } = useAuth()
  const { notificar, confirmar } = useNotification()
  const puedeVer = usuario?.rol === 'Administrador' || usuario?.rol === 'Recepcionista'
  const queryClient = useQueryClient()

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const [preview, setPreview] = useState<PagosConResumen | null>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)

  const [efectivoContado, setEfectivoContado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cerrando, setCerrando] = useState(false)

  // El toast de confirmación del último cierre reemplaza al recuadro verde
  // fijo que existía antes (ultimoCierre ya no hace falta como estado:
  // notificar() muestra el mismo mensaje como un toast que desaparece solo)

  const [cierreSeleccionadoId, setCierreSeleccionadoId] = useState<number | null>(null)

  const { data: cierres, isLoading, isError } = useQuery<CierreListado[]>({
    queryKey: ['cierres'],
    queryFn: async () => {
      const response = await api.get('/cierres')
      return response.data
    },
    enabled: puedeVer,
  })

  const {
    data: detalle,
    isLoading: cargandoDetalle,
    isError: errorDetalle,
  } = useQuery<CierreDetalle>({
    queryKey: ['cierre', cierreSeleccionadoId],
    queryFn: async () => {
      const response = await api.get(`/cierres/${cierreSeleccionadoId}`)
      return response.data
    },
    enabled: puedeVer && cierreSeleccionadoId !== null,
  })

  const limpiarResultados = () => {
    setPreview(null)
    setEfectivoContado('')
    setObservaciones('')
  }

  const cambiarDesde = (valor: string) => {
    setDesde(valor)
    limpiarResultados()
  }

  const cambiarHasta = (valor: string) => {
    setHasta(valor)
    limpiarResultados()
  }

  const aplicarPreset = (tipo: 'hoy' | 'semana' | 'mes') => {
    const rango = rangoPreset(tipo)
    setDesde(rango.desde)
    setHasta(rango.hasta)
    limpiarResultados()
  }

  const handlePrevisualizar = async () => {
    if (!desde || !hasta) {
      notificar('Selecciona las dos fechas del periodo', 'error')
      return
    }
    if (desde > hasta) {
      notificar('La fecha "desde" no puede ser posterior a "hasta"', 'error')
      return
    }

    setCargandoPreview(true)
    try {
      const response = await api.get('/cierres/previsualizar', { params: { desde, hasta } })
      setPreview(response.data)
      setEfectivoContado('')
      setObservaciones('')
    } catch (err: any) {
      setPreview(null)
      notificar(err.response?.data?.error || 'Error al previsualizar el cierre', 'error')
    } finally {
      setCargandoPreview(false)
    }
  }

  const contadoValido =
    efectivoContado !== '' && !isNaN(Number(efectivoContado)) && Number(efectivoContado) >= 0

  const diferenciaEstimada =
    preview && contadoValido
      ? Math.round((Number(efectivoContado) - Number(preview.resumen.totalEfectivo)) * 100) / 100
      : null
  const estiloDif = diferenciaEstimada !== null ? estiloDiferencia(diferenciaEstimada) : null

  // El modal de confirmación propio reemplaza al confirm() del navegador.
  // Como ahora el mensaje puede tener varias líneas, confirmar() ya
  // soporta saltos de línea gracias a "whitespace-pre-wrap" en el Context
  const handleCerrar = async () => {
    if (!preview || !contadoValido || diferenciaEstimada === null) return

    const confirmado = await confirmar(
      `Vas a cerrar ${preview.resumen.cantidad} pago(s) del ${formatearFechaInput(desde)} al ${formatearFechaInput(hasta)}.\n\n` +
      `Efectivo esperado: ${formatearDinero(preview.resumen.totalEfectivo)}\n` +
      `Efectivo contado: ${formatearDinero(efectivoContado)}\n` +
      `Diferencia: ${formatearDinero(diferenciaEstimada)}\n\n` +
      'Un cierre no se puede modificar ni eliminar.',
      { titulo: 'Confirmar cierre de caja', textoAceptar: 'Confirmar cierre' }
    )
    if (!confirmado) return

    setCerrando(true)
    try {
      const response = await api.post('/cierres', { desde, hasta, efectivoContado, observaciones })
      const cierreCreado: CierreCreado = response.data.cierre
      const { etiqueta } = estiloDiferencia(Number(cierreCreado.diferencia))

      notificar(
        `Cierre #${cierreCreado.id} realizado. Total general ${formatearDinero(cierreCreado.totalGeneral)}, ` +
        `efectivo contado ${formatearDinero(cierreCreado.efectivoContado)} (${etiqueta}: ${formatearDinero(cierreCreado.diferencia)}).`,
        'exito'
      )

      setPreview(null)
      setEfectivoContado('')
      setObservaciones('')
      queryClient.invalidateQueries({ queryKey: ['cierres'] })
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al realizar el cierre', 'error')
    } finally {
      setCerrando(false)
    }
  }

  if (!puedeVer) {
    return <p className="text-red-400">No tienes acceso a esta sección.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Cierres de caja</h1>

      <div className="bg-slate-800 rounded p-4 mb-8">
        <h2 className="text-white font-bold mb-3">Nuevo cierre</h2>

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
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => cambiarDesde(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => cambiarHasta(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />
          </div>
          <button
            type="button"
            onClick={handlePrevisualizar}
            disabled={cargandoPreview}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {cargandoPreview ? 'Consultando...' : 'Previsualizar'}
          </button>
        </div>

        {preview && (
          <div className="mt-6">
            {preview.resumen.cantidad === 0 ? (
              <p className="text-slate-300">No hay pagos pendientes de cierre en este rango.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3 max-w-2xl">
                  <TarjetaDato titulo="Pagos pendientes" valor={String(preview.resumen.cantidad)} />
                  <TarjetaDato titulo="Total general" valor={formatearDinero(preview.resumen.totalGeneral)} />
                  <TarjetaDato
                    titulo="Efectivo esperado en caja"
                    valor={formatearDinero(preview.resumen.totalEfectivo)}
                  />
                </div>
                <div className="mb-4">
                  <ChipsMetodo porMetodo={preview.resumen.porMetodo} />
                </div>

                <div className="max-h-64 overflow-y-auto mb-6">
                  <TablaPagos pagos={preview.pagos} />
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-2xl">
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Efectivo contado en caja</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Ej: 240000"
                      value={efectivoContado}
                      onChange={(e) => setEfectivoContado(e.target.value)}
                      className="w-full p-2 rounded bg-slate-700 text-white"
                    />
                  </div>

                  <div className="flex items-end pb-2">
                    {estiloDif && diferenciaEstimada !== null && (
                      <p className={`font-bold ${estiloDif.clase}`}>
                        {estiloDif.etiqueta}: {formatearDinero(diferenciaEstimada)}
                      </p>
                    )}
                  </div>

                  <textarea
                    placeholder="Observaciones (opcional): explica cualquier faltante, sobrante o novedad"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    className="col-span-2 p-2 rounded bg-slate-700 text-white"
                  />

                  <button
                    type="button"
                    onClick={handleCerrar}
                    disabled={!contadoValido || cerrando}
                    className="col-span-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-white mb-3">Historial de cierres</h2>

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los cierres</p>}

      {cierres && cierres.length === 0 && (
        <p className="text-slate-400">Todavía no se ha realizado ningún cierre.</p>
      )}

      {cierres && cierres.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-white text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-2 pr-4">Cierre</th>
                <th className="py-2 pr-4">Periodo</th>
                <th className="py-2 pr-4 text-right">Pagos</th>
                <th className="py-2 pr-4 text-right">Total general</th>
                <th className="py-2 pr-4 text-right">Efectivo esperado</th>
                <th className="py-2 pr-4 text-right">Efectivo contado</th>
                <th className="py-2 pr-4 text-right">Diferencia</th>
                <th className="py-2 pr-4">Realizado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cierres.map((cierre) => {
                const estilo = estiloDiferencia(Number(cierre.diferencia))
                return (
                  <tr key={cierre.id} className="border-b border-slate-800">
                    <td className="py-2 pr-4">#{cierre.id}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {textoPeriodo(cierre.fechaDesde, cierre.fechaHasta)}
                    </td>
                    <td className="py-2 pr-4 text-right">{cierre._count.pagos}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatearDinero(cierre.totalGeneral)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatearDinero(cierre.totalEfectivo)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {formatearDinero(cierre.efectivoContado)}
                    </td>
                    <td className={`py-2 pr-4 text-right whitespace-nowrap font-bold ${estilo.clase}`}>
                      {formatearDinero(cierre.diferencia)}
                      <span className="block text-xs font-normal">{estilo.etiqueta}</span>
                    </td>
                    <td className="py-2 pr-4">
                      {cierre.cerradoPor.nombre}
                      <span className="block text-slate-500 text-xs">{formatearFechaHora(cierre.fechaCierre)}</span>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => setCierreSeleccionadoId(cierre.id)}
                        className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-xs"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {cierreSeleccionadoId !== null && (
        <div
          onClick={() => setCierreSeleccionadoId(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 cursor-default"
          >
            {errorDetalle && <p className="text-red-400">Error al cargar el detalle del cierre</p>}
            {cargandoDetalle && <p className="text-white">Cargando...</p>}

            {detalle && (
              <>
                <h2 className="text-white text-xl font-bold">Cierre #{detalle.id}</h2>
                <p className="text-slate-400 text-sm mb-4">
                  Periodo: {textoPeriodo(detalle.fechaDesde, detalle.fechaHasta)} — realizado por{' '}
                  {detalle.cerradoPor.nombre} el {formatearFechaHora(detalle.fechaCierre)}
                </p>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  <TarjetaDato titulo="Total general" valor={formatearDinero(detalle.totalGeneral)} />
                  <TarjetaDato titulo="Efectivo esperado" valor={formatearDinero(detalle.totalEfectivo)} />
                  <TarjetaDato titulo="Efectivo contado" valor={formatearDinero(detalle.efectivoContado)} />
                  <TarjetaDato
                    titulo={estiloDiferencia(Number(detalle.diferencia)).etiqueta}
                    valor={formatearDinero(detalle.diferencia)}
                    claseValor={estiloDiferencia(Number(detalle.diferencia)).clase}
                  />
                </div>

                {detalle.observaciones && (
                  <p className="text-slate-300 text-sm whitespace-pre-wrap mb-4">
                    <span className="text-slate-400">Observaciones: </span>
                    {detalle.observaciones}
                  </p>
                )}

                <div className="mb-4">
                  <ChipsMetodo porMetodo={detalle.desglose.porMetodo} />
                </div>

                <TablaPagos pagos={detalle.pagos} />

                <button
                  onClick={() => setCierreSeleccionadoId(null)}
                  className="mt-4 bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CierresPage