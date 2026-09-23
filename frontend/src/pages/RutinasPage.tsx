import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api'

interface Cliente {
  id: number
  nombre: string
  documento: string
}

interface SeccionCuerpo {
  id: number
  nombre: string
}

interface Ejercicio {
  id: number
  nombre: string
  descripcion: string | null
  imagenUrl: string | null
  seccionCuerpoId: number
}

interface RutinaEjercicio {
  id: number
  series: number
  repeticiones: number
  peso: string | null
  orden: number
  ejercicio: Ejercicio
}

interface Rutina {
  id: number
  nombre: string
  diaSemana: string
  rutinaEjercicios: RutinaEjercicio[]
}

const DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

function formatearPeso(peso: string | null): string {
  if (!peso) return 'sin peso'

  const valores = peso.split(',').map((v) => v.trim()).filter((v) => v !== '')

  if (valores.length <= 1) return `${peso} kg`

  return valores.map((v) => `${v}kg`).join(', ')
}

function RutinasPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const [nombreRutina, setNombreRutina] = useState('')
  const [diaRutina, setDiaRutina] = useState('LUNES')

  const [rutinaAgregandoEjercicio, setRutinaAgregandoEjercicio] = useState<number | null>(null)
  const [filtroSeccionAgregar, setFiltroSeccionAgregar] = useState('')
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState('')
  const [series, setSeries] = useState('')
  const [repeticiones, setRepeticiones] = useState('')
  const [peso, setPeso] = useState('')

  const [itemEditando, setItemEditando] = useState<RutinaEjercicio | null>(null)
  const [seriesEdit, setSeriesEdit] = useState('')
  const [repeticionesEdit, setRepeticionesEdit] = useState('')
  const [pesoEdit, setPesoEdit] = useState('')

  const [ejercicioAmpliado, setEjercicioAmpliado] = useState<Ejercicio | null>(null)

  const { data: cliente } = useQuery<Cliente>({
    queryKey: ['cliente', id],
    queryFn: async () => {
      const response = await api.get(`/clientes/${id}`)
      return response.data
    },
  })

  const { data: rutinas, isLoading, isError } = useQuery<Rutina[]>({
    queryKey: ['rutinas', id],
    queryFn: async () => {
      const response = await api.get(`/rutinas/cliente/${id}`)
      return response.data
    },
  })

  const { data: ejercicios } = useQuery<Ejercicio[]>({
    queryKey: ['ejercicios'],
    queryFn: async () => {
      const response = await api.get('/ejercicios')
      return response.data
    },
  })

  const { data: secciones } = useQuery<SeccionCuerpo[]>({
    queryKey: ['secciones-cuerpo'],
    queryFn: async () => {
      const response = await api.get('/secciones-cuerpo')
      return response.data
    },
  })

  const ejerciciosFiltradosParaAgregar = ejercicios?.filter((ejercicio) =>
    filtroSeccionAgregar ? ejercicio.seccionCuerpoId === Number(filtroSeccionAgregar) : true
  )

  const handleCrearRutina = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/rutinas', { clienteId: id, nombre: nombreRutina, diaSemana: diaRutina })
      setNombreRutina('')
      queryClient.invalidateQueries({ queryKey: ['rutinas', id] })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear la rutina')
    }
  }

  const handleEliminarRutina = async (rutinaId: number) => {
    if (!confirm('¿Eliminar esta rutina completa, con todos sus ejercicios?')) return
    try {
      await api.delete(`/rutinas/${rutinaId}`)
      queryClient.invalidateQueries({ queryKey: ['rutinas', id] })
    } catch (err) {
      alert('Error al eliminar la rutina')
    }
  }

  const abrirAgregarEjercicio = (rutinaId: number) => {
    setRutinaAgregandoEjercicio(rutinaId)
    setFiltroSeccionAgregar('')
    setEjercicioSeleccionado('')
    setSeries('')
    setRepeticiones('')
    setPeso('')
  }

  const handleAgregarEjercicio = async (e: React.FormEvent, rutinaId: number) => {
    e.preventDefault()

    if (!ejercicioSeleccionado || !series || !repeticiones) {
      alert('Selecciona un ejercicio, y completa series y repeticiones')
      return
    }

    try {
      await api.post(`/rutinas/${rutinaId}/ejercicios`, {
        ejercicioId: ejercicioSeleccionado,
        series,
        repeticiones,
        peso: peso || null,
      })
      setRutinaAgregandoEjercicio(null)
      queryClient.invalidateQueries({ queryKey: ['rutinas', id] })
    } catch (err) {
      alert('Error al agregar el ejercicio')
    }
  }

  const abrirEdicionItem = (item: RutinaEjercicio) => {
    setItemEditando(item)
    setSeriesEdit(String(item.series))
    setRepeticionesEdit(String(item.repeticiones))
    setPesoEdit(item.peso ?? '')
  }

  const handleActualizarItem = async (e: React.FormEvent, rutinaId: number) => {
    e.preventDefault()
    if (!itemEditando) return

    if (!seriesEdit || !repeticionesEdit) {
      alert('Series y repeticiones son obligatorios')
      return
    }

    try {
      await api.put(`/rutinas/${rutinaId}/ejercicios/${itemEditando.id}`, {
        series: seriesEdit,
        repeticiones: repeticionesEdit,
        peso: pesoEdit || null,
      })
      setItemEditando(null)
      queryClient.invalidateQueries({ queryKey: ['rutinas', id] })
    } catch (err) {
      alert('Error al actualizar el ejercicio')
    }
  }

  const handleQuitarEjercicio = async (rutinaId: number, rutinaEjercicioId: number) => {
    if (!confirm('¿Quitar este ejercicio de la rutina?')) return
    try {
      await api.delete(`/rutinas/${rutinaId}/ejercicios/${rutinaEjercicioId}`)
      queryClient.invalidateQueries({ queryKey: ['rutinas', id] })
    } catch (err) {
      alert('Error al quitar el ejercicio')
    }
  }

  return (
    <div>
      <Link to="/clientes" className="text-slate-400 hover:text-white text-sm mb-4 inline-block">
        ← Volver a clientes
      </Link>

      <h1 className="text-3xl font-bold text-white mb-1">
        Rutinas de {cliente ? cliente.nombre : 'Cargando...'}
      </h1>
      {cliente && <p className="text-slate-400 mb-6">Documento: {cliente.documento}</p>}

      <form onSubmit={handleCrearRutina} className="flex gap-2 mb-8 bg-slate-800 p-4 rounded max-w-2xl">
        <input
          type="text"
          placeholder="Nombre de la rutina (ej. Pecho y tríceps)"
          value={nombreRutina}
          onChange={(e) => setNombreRutina(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white flex-1"
        />
        <select
          value={diaRutina}
          onChange={(e) => setDiaRutina(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white"
        >
          {DIAS_SEMANA.map((dia) => (
            <option key={dia} value={dia}>
              {dia}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Crear rutina
        </button>
      </form>

      {isLoading && <p className="text-white">Cargando rutinas...</p>}
      {isError && <p className="text-red-400">Error al cargar las rutinas</p>}

      {rutinas && rutinas.length === 0 && (
        <p className="text-slate-400">Este cliente todavía no tiene rutinas asignadas.</p>
      )}

      <div className="flex flex-col gap-6">
        {rutinas?.map((rutina) => (
          <div key={rutina.id} className="bg-slate-800 rounded p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded mr-2">
                  {rutina.diaSemana}
                </span>
                <span className="text-white font-bold text-lg">{rutina.nombre}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirAgregarEjercicio(rutina.id)}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                >
                  + Ejercicio
                </button>
                <button
                  onClick={() => handleEliminarRutina(rutina.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                >
                  Eliminar rutina
                </button>
              </div>
            </div>

            {rutinaAgregandoEjercicio === rutina.id && (
              <form
                onSubmit={(e) => handleAgregarEjercicio(e, rutina.id)}
                className="grid grid-cols-4 gap-2 mb-4 bg-slate-900 p-3 rounded"
              >
                <select
                  value={filtroSeccionAgregar}
                  onChange={(e) => {
                    setFiltroSeccionAgregar(e.target.value)
                    setEjercicioSeleccionado('')
                  }}
                  className="p-2 rounded bg-slate-700 text-white col-span-4"
                >
                  <option value="">Filtrar por sección del cuerpo (todas)</option>
                  {secciones?.map((seccion) => (
                    <option key={seccion.id} value={seccion.id}>
                      {seccion.nombre}
                    </option>
                  ))}
                </select>

                <select
                  value={ejercicioSeleccionado}
                  onChange={(e) => setEjercicioSeleccionado(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white col-span-4"
                >
                  <option value="">Selecciona un ejercicio</option>
                  {ejerciciosFiltradosParaAgregar?.map((ejercicio) => (
                    <option key={ejercicio.id} value={ejercicio.id}>
                      {ejercicio.nombre}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Series"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white"
                />
                <input
                  type="number"
                  placeholder="Repeticiones"
                  value={repeticiones}
                  onChange={(e) => setRepeticiones(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white"
                />
                <input
                  type="text"
                  placeholder="Peso: 15 o 12,14,16,13"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white col-span-2"
                />
                <p className="text-slate-400 text-xs col-span-4 -mt-1">
                  Peso opcional. Un solo valor si es el mismo en todas las series, o varios
                  separados por coma (uno por serie), ej: 12,14,16,13
                </p>
                <button type="submit" className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm col-span-4">
                  Agregar
                </button>
              </form>
            )}

            {itemEditando && rutina.rutinaEjercicios.some((i) => i.id === itemEditando.id) && (
              <form
                onSubmit={(e) => handleActualizarItem(e, rutina.id)}
                className="grid grid-cols-4 gap-2 mb-4 bg-slate-900 p-3 rounded border border-yellow-600"
              >
                <p className="text-white text-sm col-span-4 font-bold">
                  Editando: {itemEditando.ejercicio.nombre}
                </p>
                <input
                  type="number"
                  placeholder="Series"
                  value={seriesEdit}
                  onChange={(e) => setSeriesEdit(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white"
                />
                <input
                  type="number"
                  placeholder="Repeticiones"
                  value={repeticionesEdit}
                  onChange={(e) => setRepeticionesEdit(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white"
                />
                <input
                  type="text"
                  placeholder="Peso: 15 o 12,14,16,13"
                  value={pesoEdit}
                  onChange={(e) => setPesoEdit(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white col-span-2"
                />
                <div className="col-span-4 flex gap-2">
                  <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm">
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemEditando(null)}
                    className="bg-slate-600 text-white px-3 py-2 rounded hover:bg-slate-700 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {rutina.rutinaEjercicios.length === 0 ? (
              <p className="text-slate-400 text-sm">Sin ejercicios asignados todavía.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {rutina.rutinaEjercicios.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-slate-900 p-2 rounded">
                    {item.ejercicio.imagenUrl ? (
                      <img
                        src={`http://localhost:3000${item.ejercicio.imagenUrl}`}
                        alt={item.ejercicio.nombre}
                        onClick={() => setEjercicioAmpliado(item.ejercicio)}
                        className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-700 rounded flex items-center justify-center text-xs text-slate-400">
                        S/I
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-white text-sm font-bold">{item.ejercicio.nombre}</p>
                      <p className="text-slate-400 text-xs">
                        {item.series} series x {item.repeticiones} reps — {formatearPeso(item.peso)}
                      </p>
                    </div>
                    <button
                      onClick={() => abrirEdicionItem(item)}
                      className="bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleQuitarEjercicio(rutina.id, item.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-xs"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal de revisión del ejercicio.
          NUEVO ENFOQUE: en vez de que toda la pantalla tenga scroll, le damos
          una altura máxima fija a la TARJETA del modal (max-h-[85vh]) y el
          scroll vive directamente en ella (overflow-y-auto). Este patrón es
          el estándar más confiable para modales con contenido variable,
          y evita cualquier rareza de CSS con el centrado automático */}
      {ejercicioAmpliado && ejercicioAmpliado.imagenUrl && (
        <div
          onClick={() => setEjercicioAmpliado(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded max-w-3xl w-full max-h-[85vh] overflow-y-auto p-4 cursor-default"
          >
            <img
              src={`http://localhost:3000${ejercicioAmpliado.imagenUrl}`}
              alt={ejercicioAmpliado.nombre}
              className="w-full max-h-[50vh] object-contain rounded"
            />
            <p className="text-white text-center mt-4 text-lg font-bold">
              {ejercicioAmpliado.nombre}
            </p>
            {ejercicioAmpliado.descripcion && (
              <p className="text-slate-300 text-center text-sm mt-2 whitespace-pre-wrap">
                {ejercicioAmpliado.descripcion}
              </p>
            )}
            <p className="text-slate-400 text-center text-xs mt-4">
              Haz clic fuera de esta tarjeta para cerrar y volver a la rutina
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default RutinasPage