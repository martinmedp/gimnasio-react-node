import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import { mensajeDeError } from '../utils/errores'
import { formatearFechaHora } from '../utils/formato'

interface Configuracion {
  id: number
  activo: boolean
  hora: string
}

interface RespaldoRegistro {
  id: number
  creadoEn: string
  // "manual" (botón) o "programado" (reloj)
  origen: string
  // "ok" o "error"
  estado: string
  archivo: string | null
  tamanoBytes: number | null
  mensaje: string | null
  creadoPor: { nombre: string } | null
  // ¿El archivo sigue en el disco del servidor?
  disponible: boolean
}

interface DatosRespaldos {
  configuracion: Configuracion
  enCurso: boolean
  respaldos: RespaldoRegistro[]
}

function formatearTamano(bytes: number | null): string {
  if (bytes === null) return '-'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Cuando se descarga un archivo, axios pide la respuesta como "blob"
// (datos binarios). Si el backend responde con un error, ese error JSON
// también llega como blob, así que hay que leerlo como texto para sacar su
// mensaje ("Contraseña incorrecta", etc.)
async function mensajeDeErrorDeDescarga(error: unknown, porDefecto: string): Promise<string> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const texto = await error.response.data.text()
      const cuerpo = JSON.parse(texto)
      if (typeof cuerpo.error === 'string') return cuerpo.error
    } catch {
      // Si no se puede leer, se usa el mensaje por defecto
    }
  }
  return mensajeDeError(error, porDefecto)
}

function RespaldosPage() {
  const { usuario } = useAuth()
  const { notificar } = useNotification()
  const queryClient = useQueryClient()
  const esAdministrador = usuario?.rol === 'Administrador'

  // Estado del formulario de programación (se llena con lo guardado)
  const [activo, setActivo] = useState(false)
  const [hora, setHora] = useState('20:00')
  const [guardando, setGuardando] = useState(false)

  const [creando, setCreando] = useState(false)

  // Ventana de descarga: el respaldo elegido y la contraseña escrita
  const [respaldoADescargar, setRespaldoADescargar] = useState<RespaldoRegistro | null>(null)
  const [passwordDescarga, setPasswordDescarga] = useState('')
  const [descargando, setDescargando] = useState(false)

  const { data, isLoading, isError, error } = useQuery<DatosRespaldos>({
    queryKey: ['respaldos'],
    queryFn: async () => {
      const response = await api.get('/respaldos')
      return response.data
    },
    enabled: esAdministrador,
    // Se actualiza sola: cada 3 segundos mientras hay un respaldo en curso
    // y cada 30 segundos el resto del tiempo (así se ven los programados)
    refetchInterval: (consulta) => (consulta.state.data?.enCurso ? 3000 : 30000),
  })

  // Cuando llega (o cambia) la configuración guardada, se refleja en el
  // formulario. Depende solo de sus valores, para no pisar lo que estés
  // escribiendo si la lista se actualiza sola
  const activoGuardado = data?.configuracion.activo
  const horaGuardada = data?.configuracion.hora
  useEffect(() => {
    if (activoGuardado !== undefined && horaGuardada !== undefined) {
      setActivo(activoGuardado)
      setHora(horaGuardada)
    }
  }, [activoGuardado, horaGuardada])

  const hayCambios = data !== undefined && (activo !== data.configuracion.activo || hora !== data.configuracion.hora)

  const handleGuardarConfiguracion = async () => {
    if (!hora) {
      notificar('Indica la hora del respaldo', 'error')
      return
    }

    setGuardando(true)
    try {
      await api.put('/respaldos/configuracion', { activo, hora })
      notificar(activo ? `Respaldo diario programado a las ${hora}` : 'Respaldo diario desactivado', 'exito')
      queryClient.invalidateQueries({ queryKey: ['respaldos'] })
    } catch (err) {
      notificar(mensajeDeError(err, 'No se pudo guardar la configuración'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleRespaldarAhora = async () => {
    setCreando(true)
    try {
      const response = await api.post('/respaldos')
      notificar(`Respaldo creado (${formatearTamano(response.data.tamanoBytes)})`, 'exito')
    } catch (err) {
      notificar(mensajeDeError(err, 'No se pudo crear el respaldo'), 'error')
    } finally {
      setCreando(false)
      // Se actualiza la lista tanto si salió bien como si falló: el intento
      // queda registrado en el historial en ambos casos
      queryClient.invalidateQueries({ queryKey: ['respaldos'] })
    }
  }

  const abrirVentanaDescarga = (respaldo: RespaldoRegistro) => {
    setRespaldoADescargar(respaldo)
    setPasswordDescarga('')
  }

  const handleDescargar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!respaldoADescargar) return

    if (!passwordDescarga) {
      notificar('Debes ingresar tu contraseña', 'error')
      return
    }

    setDescargando(true)
    try {
      const response = await api.post(
        `/respaldos/${respaldoADescargar.id}/descargar`,
        { password: passwordDescarga },
        { responseType: 'blob' }
      )

      // Para guardar un archivo que llegó por axios se crea un enlace
      // temporal "de descarga" y se pulsa por código
      const direccion = URL.createObjectURL(response.data)
      const enlace = document.createElement('a')
      enlace.href = direccion
      enlace.download = respaldoADescargar.archivo ?? `respaldo-${respaldoADescargar.id}.zip`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(direccion), 1000)

      notificar('Descarga iniciada. Guarda el archivo en un lugar seguro.', 'exito')
      setRespaldoADescargar(null)
    } catch (err) {
      // Si la contraseña es incorrecta, la ventana queda abierta para corregir
      notificar(await mensajeDeErrorDeDescarga(err, 'No se pudo descargar el respaldo'), 'error')
    } finally {
      setDescargando(false)
    }
  }

  // Todos los hooks ya se llamaron arriba; este return anticipado es seguro
  if (!esAdministrador) {
    return <p className="text-red-400">No tienes acceso a esta sección.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Respaldos</h1>
      <p className="text-slate-400 text-sm mb-6 max-w-3xl">
        Cada respaldo guarda la base de datos completa y las imágenes (fotos de clientes y ejercicios) en un solo archivo.
        Se conservan los últimos 14. Descarga de vez en cuando uno y guárdalo fuera de este equipo (un USB o tu nube):
        si el disco falla, los respaldos que están en él se pierden junto con todo lo demás.
      </p>

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">{mensajeDeError(error, 'No se pudieron cargar los respaldos.')}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8 max-w-4xl">
            {/* Respaldar ahora */}
            <div className="bg-slate-800 rounded p-4">
              <h2 className="text-white font-bold mb-2">Respaldar ahora</h2>
              <p className="text-slate-400 text-sm mb-3">Crea un respaldo en este momento. Puede tardar unos segundos.</p>
              <button
                onClick={handleRespaldarAhora}
                disabled={creando || data.enCurso}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {creando || data.enCurso ? 'Creando respaldo...' : 'Respaldar ahora'}
              </button>
            </div>

            {/* Respaldo automático */}
            <div className="bg-slate-800 rounded p-4">
              <h2 className="text-white font-bold mb-2">Respaldo automático diario</h2>
              <label className="flex items-center gap-2 text-white text-sm mb-3">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                Activar el respaldo diario
              </label>
              <div className="flex items-end gap-3 mb-2">
                <div>
                  <label className="text-slate-400 text-sm block mb-1">Hora</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="p-2 rounded bg-slate-700 text-white"
                  />
                </div>
                <button
                  onClick={handleGuardarConfiguracion}
                  disabled={!hayCambios || guardando}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              <p className="text-slate-500 text-xs">
                Hora guardada: {data.configuracion.hora} (formato de 24 horas, aunque el selector muestre a. m. / p. m.).
                Se ejecuta mientras el sistema esté encendido; si estaba apagado a esa hora, se hace al encenderlo.
              </p>
            </div>
          </div>

          {/* Historial */}
          <h2 className="text-xl font-bold text-white mb-3">Historial</h2>

          {data.respaldos.length === 0 ? (
            <p className="text-slate-400">Todavía no se ha hecho ningún respaldo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-white text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="py-2 pr-4">Fecha y hora</th>
                    <th className="py-2 pr-4">Origen</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Tamaño</th>
                    <th className="py-2 pr-4">Detalle</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.respaldos.map((respaldo) => (
                    <tr key={respaldo.id} className="border-b border-slate-800 align-top">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatearFechaHora(respaldo.creadoEn)}</td>
                      <td className="py-2 pr-4">
                        {respaldo.origen === 'manual' ? 'Manual' : 'Programado'}
                        {respaldo.creadoPor && (
                          <span className="block text-slate-500 text-xs">{respaldo.creadoPor.nombre}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {respaldo.estado === 'ok' ? (
                          <span className="bg-green-700 text-xs px-2 py-1 rounded">Correcto</span>
                        ) : (
                          <span className="bg-red-700 text-xs px-2 py-1 rounded">Falló</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatearTamano(respaldo.tamanoBytes)}</td>
                      <td className="py-2 pr-4 max-w-md wrap-break-word text-xs">
                        {respaldo.estado === 'error' ? (
                          <span className="text-red-300">{respaldo.mensaje}</span>
                        ) : respaldo.archivo === null ? (
                          <span className="text-slate-500">Archivo eliminado (se conservan los últimos 14)</span>
                        ) : respaldo.disponible ? (
                          <span className="text-slate-400">{respaldo.archivo}</span>
                        ) : (
                          <span className="text-yellow-400">El archivo ya no está en el servidor</span>
                        )}
                      </td>
                      <td className="py-2">
                        {respaldo.disponible && (
                          <button
                            onClick={() => abrirVentanaDescarga(respaldo)}
                            className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-xs"
                          >
                            Descargar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Ventana de descarga: pide la contraseña porque un respaldo contiene
          todos los datos personales de los clientes. No se cierra al hacer
          clic fuera, para no perder lo escrito por accidente */}
      {respaldoADescargar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
          <form onSubmit={handleDescargar} className="bg-slate-800 rounded p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-2">Descargar respaldo</h2>
            <p className="text-slate-300 text-sm mb-1">
              {formatearFechaHora(respaldoADescargar.creadoEn)} — {formatearTamano(respaldoADescargar.tamanoBytes)}
            </p>
            <p className="text-slate-400 text-xs mb-4">
              Este archivo contiene los datos personales de todos los clientes. Guárdalo en un lugar seguro y no lo
              compartas. Por eso se pide tu contraseña de Administrador.
            </p>

            <label className="text-slate-400 text-sm block mb-1">Tu contraseña</label>
            <input
              type="password"
              value={passwordDescarga}
              onChange={(e) => setPasswordDescarga(e.target.value)}
              className="w-full p-2 rounded bg-slate-700 text-white mb-4"
              autoFocus
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRespaldoADescargar(null)}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={descargando}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {descargando ? 'Descargando...' : 'Descargar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default RespaldosPage