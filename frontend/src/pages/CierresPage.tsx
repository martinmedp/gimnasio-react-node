import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import { abrirPdf } from '../utils/descargarPdf'
import TarjetaDato from '../components/TarjetaDato'
import TablaPagos, { ChipsMetodo } from '../components/TablaPagos'
import TablaGastos from '../components/TablaGastos'
import {
  estiloDiferencia,
  formatearDinero,
  formatearFecha,
  formatearFechaHora,
  formatearFechaInput,
  rangoPreset,
} from '../utils/formato'
import type { GastoRegistro, PagoRegistro, PrevisualizacionCierre, Resumen } from '../types/contabilidad'

interface Cierre {
  id: number
  fechaDesde: string
  fechaHasta: string
  totalGeneral: string
  totalEfectivo: string
  // Nuevos: totales de gastos del periodo, guardados al cerrar
  totalGastos: string
  totalGastosEfectivo: string
  efectivoContado: string
  diferencia: string
  observaciones: string | null
  fechaCierre: string
  cerradoPor: { nombre: string }
  revertido: boolean
  revertidoEn: string | null
  revertidoPor: { nombre: string } | null
  motivoReversion: string | null
}

interface CierreListado extends Cierre {
  _count: { pagos: number; gastos: number }
}

interface CierreDetalle extends Cierre {
  pagos: PagoRegistro[]
  gastos: GastoRegistro[]
  desglose: Resumen
  desgloseGastos: Resumen
}

interface CierreCreado {
  id: number
  totalGeneral: string
  totalGastos: string
  efectivoContado: string
  diferencia: string
}

function textoPeriodo(desdeIso: string, hastaIso: string): string {
  const desde = formatearFecha(desdeIso)
  const hasta = formatearFecha(hastaIso)
  return desde === hasta ? desde : `${desde} – ${hasta}`
}

// El efectivo esperado no se guarda como campo propio: se deduce de lo que
// sí se guardó (efectivo de ingresos menos efectivo de gastos). Redondeamos
// a 2 decimales para evitar restos raros de la aritmética de coma flotante.
// En cierres anteriores a la función de gastos, totalGastosEfectivo vale 0,
// así que el resultado sigue siendo el mismo que se mostraba antes
function efectivoEsperadoDe(cierre: Cierre): number {
  return Math.round((Number(cierre.totalEfectivo) - Number(cierre.totalGastosEfectivo)) * 100) / 100
}

function CierresPage() {
  const { usuario } = useAuth()
  const { notificar, confirmar } = useNotification()
  const puedeVer = usuario?.rol === 'Administrador' || usuario?.rol === 'Recepcionista'
  const esAdministrador = usuario?.rol === 'Administrador'
  const queryClient = useQueryClient()

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Ahora la previsualización trae también los gastos pendientes
  const [preview, setPreview] = useState<PrevisualizacionCierre | null>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)

  const [efectivoContado, setEfectivoContado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cerrando, setCerrando] = useState(false)

  const [cierreSeleccionadoId, setCierreSeleccionadoId] = useState<number | null>(null)

  const [cierreARevertir, setCierreARevertir] = useState<CierreListado | null>(null)
  const [passwordRevertir, setPasswordRevertir] = useState('')
  const [motivoRevertir, setMotivoRevertir] = useState('')
  const [revirtiendo, setRevirtiendo] = useState(false)

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

  // CAMBIO CLAVE: ahora comparamos contra efectivoEsperado (ingresos en
  // efectivo menos gastos en efectivo), el mismo valor que usa el backend
  // al guardar el cierre. Antes usábamos totalEfectivo, que solo cuenta ingresos
  const diferenciaEstimada =
    preview && contadoValido
      ? Math.round((Number(efectivoContado) - Number(preview.resumen.efectivoEsperado)) * 100) / 100
      : null
  const estiloDif = diferenciaEstimada !== null ? estiloDiferencia(diferenciaEstimada) : null

  // Resultado neto del periodo (ingresos menos gastos), solo para mostrar
  const netoPreview = preview
    ? Math.round((Number(preview.resumen.totalGeneral) - Number(preview.resumen.totalGastos)) * 100) / 100
    : null

  // Un periodo con solo gastos (o solo pagos) también se puede cerrar
  const previewVacio = preview !== null && preview.resumen.cantidad === 0 && preview.gastos.length === 0

  const handleCerrar = async () => {
    if (!preview || !contadoValido || diferenciaEstimada === null) return

    const confirmado = await confirmar(
      `Vas a cerrar ${preview.resumen.cantidad} pago(s) y ${preview.gastos.length} gasto(s) del ${formatearFechaInput(desde)} al ${formatearFechaInput(hasta)}.\n\n` +
      `Ingresos: ${formatearDinero(preview.resumen.totalGeneral)}\n` +
      `Gastos: ${formatearDinero(preview.resumen.totalGastos)}\n` +
      `Efectivo esperado: ${formatearDinero(preview.resumen.efectivoEsperado)}\n` +
      `Efectivo contado: ${formatearDinero(efectivoContado)}\n` +
      `Diferencia: ${formatearDinero(diferenciaEstimada)}\n\n` +
      'Un cierre no se puede modificar, solo revertir por un Administrador.',
      { titulo: 'Confirmar cierre de caja', textoAceptar: 'Confirmar cierre' }
    )
    if (!confirmado) return

    setCerrando(true)
    try {
      const response = await api.post('/cierres', { desde, hasta, efectivoContado, observaciones })
      const cierreCreado: CierreCreado = response.data.cierre
      const { etiqueta } = estiloDiferencia(Number(cierreCreado.diferencia))

      notificar(
        `Cierre #${cierreCreado.id} realizado. Ingresos ${formatearDinero(cierreCreado.totalGeneral)}, ` +
        `gastos ${formatearDinero(cierreCreado.totalGastos)}, ` +
        `efectivo contado ${formatearDinero(cierreCreado.efectivoContado)} (${etiqueta}: ${formatearDinero(cierreCreado.diferencia)}).`,
        'exito'
      )

      setPreview(null)
      setEfectivoContado('')
      setObservaciones('')
      queryClient.invalidateQueries({ queryKey: ['cierres'] })
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      // Los gastos también cambiaron de "pendiente" a "cerrado"
      queryClient.invalidateQueries({ queryKey: ['gastos'] })
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al realizar el cierre', 'error')
    } finally {
      setCerrando(false)
    }
  }

  const abrirModalReversion = (cierre: CierreListado) => {
    setCierreARevertir(cierre)
    setPasswordRevertir('')
    setMotivoRevertir('')
  }

  const handleConfirmarReversion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cierreARevertir) return

    if (!passwordRevertir) {
      notificar('Debes ingresar tu contraseña', 'error')
      return
    }
    if (!motivoRevertir.trim()) {
      notificar('Debes indicar el motivo de la reversión', 'error')
      return
    }

    setRevirtiendo(true)
    try {
      await api.post(`/cierres/${cierreARevertir.id}/revertir`, {
        password: passwordRevertir,
        motivo: motivoRevertir,
      })

      notificar(
        `Cierre #${cierreARevertir.id} revertido. Sus ${cierreARevertir._count.pagos} pago(s) y ${cierreARevertir._count.gastos} gasto(s) quedaron pendientes de un nuevo cierre.`,
        'exito'
      )

      setCierreARevertir(null)
      queryClient.invalidateQueries({ queryKey: ['cierres'] })
      queryClient.invalidateQueries({ queryKey: ['cierre', cierreARevertir.id] })
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      queryClient.invalidateQueries({ queryKey: ['gastos'] })
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al revertir el cierre', 'error')
    } finally {
      setRevirtiendo(false)
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
            {previewVacio ? (
              <p className="text-slate-300">No hay pagos ni gastos pendientes de cierre en este rango.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 max-w-3xl">
                  <TarjetaDato titulo="Total ingresos" valor={formatearDinero(preview.resumen.totalGeneral)} />
                  <TarjetaDato titulo="Total gastos" valor={formatearDinero(preview.resumen.totalGastos)} />
                  <TarjetaDato
                    titulo="Resultado neto"
                    valor={formatearDinero(netoPreview ?? 0)}
                    claseValor={netoPreview !== null && netoPreview < 0 ? 'text-red-400' : 'text-white'}
                  />
                  <TarjetaDato
                    titulo="Efectivo esperado en caja"
                    valor={formatearDinero(preview.resumen.efectivoEsperado)}
                  />
                </div>

                {/* Explicación breve de cómo se obtiene el efectivo esperado,
                    para que el cuadre sea transparente para quien cuenta la caja */}
                <p className="text-slate-400 text-sm mb-4">
                  Efectivo esperado = ingresos en efectivo ({formatearDinero(preview.resumen.totalEfectivo)}) − gastos
                  en efectivo ({formatearDinero(preview.resumen.totalGastosEfectivo)})
                </p>

                <div className="mb-4">
                  <ChipsMetodo porMetodo={preview.resumen.porMetodo} />
                </div>

                <h3 className="text-white font-bold text-sm mb-2">Ingresos pendientes ({preview.resumen.cantidad})</h3>
                <div className="max-h-64 overflow-y-auto mb-6">
                  <TablaPagos pagos={preview.pagos} />
                </div>

                <h3 className="text-white font-bold text-sm mb-2">Gastos pendientes ({preview.gastos.length})</h3>
                <div className="max-h-64 overflow-y-auto mb-6">
                  <TablaGastos gastos={preview.gastos} />
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
                <th className="py-2 pr-4 text-right">Pagos / gastos</th>
                <th className="py-2 pr-4 text-right">Ingresos</th>
                <th className="py-2 pr-4 text-right">Gastos</th>
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
                  <tr
                    key={cierre.id}
                    className={`border-b border-slate-800 ${cierre.revertido ? 'opacity-50 border-l-2 border-l-red-600' : ''}`}
                  >
                    <td className="py-2 pr-4">
                      #{cierre.id}
                      {cierre.revertido && (
                        <span className="block bg-red-700 text-white text-xs px-2 py-0.5 rounded mt-1 w-fit">
                          Revertido
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {textoPeriodo(cierre.fechaDesde, cierre.fechaHasta)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {cierre._count.pagos} / {cierre._count.gastos}
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatearDinero(cierre.totalGeneral)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatearDinero(cierre.totalGastos)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {formatearDinero(efectivoEsperadoDe(cierre))}
                    </td>
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
                    <td className="py-2 flex gap-2">
                      <button
                        onClick={() => setCierreSeleccionadoId(cierre.id)}
                        className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-xs"
                      >
                        Ver detalle
                      </button>
                      {esAdministrador && !cierre.revertido && (
                        <button
                          onClick={() => abrirModalReversion(cierre)}
                          className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800 text-xs"
                        >
                          Revertir
                        </button>
                      )}
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
                <h2 className="text-white text-xl font-bold">
                  Cierre #{detalle.id}
                  {detalle.revertido && (
                    <span className="ml-2 bg-red-700 text-white text-sm px-2 py-1 rounded align-middle">
                      Revertido
                    </span>
                  )}
                </h2>
                <p className="text-slate-400 text-sm mb-4">
                  Periodo: {textoPeriodo(detalle.fechaDesde, detalle.fechaHasta)} — realizado por{' '}
                  {detalle.cerradoPor.nombre} el {formatearFechaHora(detalle.fechaCierre)}
                </p>

                {detalle.revertido && detalle.revertidoPor && detalle.revertidoEn && (
                  <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-4">
                    <p className="text-red-300 text-sm font-bold">
                      Revertido por {detalle.revertidoPor.nombre} el {formatearFechaHora(detalle.revertidoEn)}
                    </p>
                    {detalle.motivoReversion && (
                      <p className="text-red-200 text-sm mt-1 whitespace-pre-wrap">
                        Motivo: {detalle.motivoReversion}
                      </p>
                    )}
                    <p className="text-red-300 text-xs mt-1">
                      Los pagos y gastos de este cierre quedaron pendientes nuevamente y pueden incluirse en un cierre
                      futuro.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <TarjetaDato titulo="Total ingresos" valor={formatearDinero(detalle.totalGeneral)} />
                  <TarjetaDato titulo="Total gastos" valor={formatearDinero(detalle.totalGastos)} />
                  <TarjetaDato titulo="Efectivo esperado" valor={formatearDinero(efectivoEsperadoDe(detalle))} />
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

                <h3 className="text-white font-bold text-sm mb-2">Ingresos incluidos ({detalle.pagos.length})</h3>
                <div className="mb-6">
                  <TablaPagos pagos={detalle.pagos} />
                </div>

                {/* La tabla de gastos solo aparece si el cierre tiene alguno,
                    para no mostrar un título vacío en cierres sin gastos */}
                {detalle.gastos.length > 0 && (
                  <>
                    <h3 className="text-white font-bold text-sm mb-2">Gastos incluidos ({detalle.gastos.length})</h3>
                    <div className="mb-6">
                      <TablaGastos gastos={detalle.gastos} />
                    </div>
                  </>
                )}

                <button
                  onClick={() => abrirPdf(`/cierres/${detalle.id}/pdf`)}
                  className="mt-4 mr-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                  Descargar PDF
                </button>
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

      {cierreARevertir && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmarReversion}
            className="bg-slate-800 rounded p-6 w-full max-w-md"
          >
            <h2 className="text-white font-bold text-lg mb-2">Revertir cierre #{cierreARevertir.id}</h2>
            <p className="text-slate-300 text-sm mb-4">
              Esta acción devolverá {cierreARevertir._count.pagos} pago(s) y {cierreARevertir._count.gastos} gasto(s) a
              estado pendiente. El cierre quedará marcado como revertido, no se eliminará. Esta acción requiere tu
              contraseña de Administrador.
            </p>

            <label className="text-slate-400 text-sm block mb-1">Tu contraseña</label>
            <input
              type="password"
              value={passwordRevertir}
              onChange={(e) => setPasswordRevertir(e.target.value)}
              className="w-full p-2 rounded bg-slate-700 text-white mb-3"
              autoFocus
            />

            <label className="text-slate-400 text-sm block mb-1">Motivo de la reversión</label>
            <textarea
              value={motivoRevertir}
              onChange={(e) => setMotivoRevertir(e.target.value)}
              rows={3}
              placeholder="Ej: se contó mal el efectivo, faltaba incluir un pago, etc."
              className="w-full p-2 rounded bg-slate-700 text-white mb-4"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCierreARevertir(null)}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={revirtiendo}
                className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800 disabled:opacity-50"
              >
                {revirtiendo ? 'Revirtiendo...' : 'Confirmar reversión'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default CierresPage