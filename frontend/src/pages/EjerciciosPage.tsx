import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNotification } from '../context/NotificationContext'
import api from '../api'

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
  seccionCuerpo: SeccionCuerpo
}

function EjerciciosPage() {
  const { notificar, confirmar } = useNotification()

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [seccionCuerpoId, setSeccionCuerpoId] = useState('')
  const [imagen, setImagen] = useState<File | null>(null)

  const [filtroSeccion, setFiltroSeccion] = useState('')
  const [ejercicioAmpliado, setEjercicioAmpliado] = useState<Ejercicio | null>(null)

  const [ejercicioEditando, setEjercicioEditando] = useState<Ejercicio | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [descripcionEdit, setDescripcionEdit] = useState('')
  const [seccionCuerpoIdEdit, setSeccionCuerpoIdEdit] = useState('')
  const [imagenEdit, setImagenEdit] = useState<File | null>(null)

  const queryClient = useQueryClient()

  const { data: secciones } = useQuery<SeccionCuerpo[]>({
    queryKey: ['secciones-cuerpo'],
    queryFn: async () => {
      const response = await api.get('/secciones-cuerpo')
      return response.data
    },
  })

  const { data: ejercicios, isLoading, isError } = useQuery<Ejercicio[]>({
    queryKey: ['ejercicios'],
    queryFn: async () => {
      const response = await api.get('/ejercicios')
      return response.data
    },
  })

  const ejerciciosFiltrados = ejercicios?.filter((ejercicio) =>
    filtroSeccion ? ejercicio.seccionCuerpoId === Number(filtroSeccion) : true
  )

  const handleCrearEjercicio = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombre || !seccionCuerpoId) {
      notificar('Nombre y sección del cuerpo son obligatorios', 'error')
      return
    }

    const formData = new FormData()
    formData.append('nombre', nombre)
    formData.append('descripcion', descripcion)
    formData.append('seccionCuerpoId', seccionCuerpoId)
    if (imagen) {
      formData.append('imagen', imagen)
    }

    try {
      await api.post('/ejercicios', formData)
      setNombre('')
      setDescripcion('')
      setSeccionCuerpoId('')
      setImagen(null)
      queryClient.invalidateQueries({ queryKey: ['ejercicios'] })
      notificar('Ejercicio agregado correctamente', 'exito')
    } catch (err) {
      notificar('Error al crear el ejercicio', 'error')
    }
  }

  const abrirEdicion = (ejercicio: Ejercicio) => {
    setEjercicioEditando(ejercicio)
    setNombreEdit(ejercicio.nombre)
    setDescripcionEdit(ejercicio.descripcion ?? '')
    setSeccionCuerpoIdEdit(String(ejercicio.seccionCuerpoId))
    setImagenEdit(null)
  }

  const handleActualizarEjercicio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ejercicioEditando) return

    const formData = new FormData()
    formData.append('nombre', nombreEdit)
    formData.append('descripcion', descripcionEdit)
    formData.append('seccionCuerpoId', seccionCuerpoIdEdit)
    if (imagenEdit) {
      formData.append('imagen', imagenEdit)
    }

    try {
      await api.put(`/ejercicios/${ejercicioEditando.id}`, formData)
      setEjercicioEditando(null)
      queryClient.invalidateQueries({ queryKey: ['ejercicios'] })
      notificar('Ejercicio actualizado correctamente', 'exito')
    } catch (err) {
      notificar('Error al actualizar el ejercicio', 'error')
    }
  }

  // El handler ahora es async: "await confirmar(...)" espera a que el
  // usuario responda en el modal personalizado antes de continuar
  const handleEliminarEjercicio = async (id: number) => {
    const confirmado = await confirmar('¿Eliminar este ejercicio?', {
      variante: 'peligro',
      textoAceptar: 'Eliminar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/ejercicios/${id}`)
      queryClient.invalidateQueries({ queryKey: ['ejercicios'] })
      notificar('Ejercicio eliminado', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al eliminar el ejercicio', 'error')
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Catálogo de ejercicios</h1>

      <form onSubmit={handleCrearEjercicio} className="grid grid-cols-2 gap-2 mb-6 bg-slate-800 p-4 rounded max-w-2xl">
        <input
          type="text"
          placeholder="Nombre del ejercicio"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white"
        />

        <select
          value={seccionCuerpoId}
          onChange={(e) => setSeccionCuerpoId(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white"
        >
          <option value="">Selecciona sección del cuerpo</option>
          {secciones?.map((seccion) => (
            <option key={seccion.id} value={seccion.id}>
              {seccion.nombre}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Descripción (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white col-span-2"
          rows={2}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImagen(e.target.files ? e.target.files[0] : null)}
          className="p-2 rounded bg-slate-700 text-white col-span-2"
        />

        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 col-span-2">
          Agregar ejercicio
        </button>
      </form>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-white text-sm">Filtrar por sección:</label>
        <select
          value={filtroSeccion}
          onChange={(e) => setFiltroSeccion(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white"
        >
          <option value="">Todas</option>
          {secciones?.map((seccion) => (
            <option key={seccion.id} value={seccion.id}>
              {seccion.nombre}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los ejercicios</p>}

      {ejerciciosFiltrados && ejerciciosFiltrados.length === 0 && (
        <p className="text-slate-400">No hay ejercicios para esta sección.</p>
      )}

      {ejerciciosFiltrados && ejerciciosFiltrados.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {ejerciciosFiltrados.map((ejercicio) => (
            <div key={ejercicio.id} className="bg-slate-800 rounded p-4">
              {ejercicio.imagenUrl ? (
                <img
                  src={`http://localhost:3000${ejercicio.imagenUrl}`}
                  alt={ejercicio.nombre}
                  onClick={() => setEjercicioAmpliado(ejercicio)}
                  className="w-full h-56 object-contain bg-slate-900 rounded mb-2 cursor-pointer hover:opacity-80 transition"
                />
              ) : (
                <div className="w-full h-56 bg-slate-700 rounded mb-2 flex items-center justify-center text-slate-400 text-sm">
                  Sin imagen
                </div>
              )}
              <h3 className="text-white font-bold">{ejercicio.nombre}</h3>
              <p className="text-slate-400 text-sm">{ejercicio.seccionCuerpo.nombre}</p>
              {ejercicio.descripcion && (
                <p className="text-slate-300 text-sm mt-1">{ejercicio.descripcion}</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => abrirEdicion(ejercicio)}
                  className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleEliminarEjercicio(ejercicio.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {ejercicioAmpliado && ejercicioAmpliado.imagenUrl && (
        <div
          onClick={() => setEjercicioAmpliado(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8 cursor-pointer"
        >
          <div className="max-w-3xl w-full">
            <img
              src={`http://localhost:3000${ejercicioAmpliado.imagenUrl}`}
              alt={ejercicioAmpliado.nombre}
              className="w-full max-h-[80vh] object-contain rounded"
            />
            <p className="text-white text-center mt-4 text-lg font-bold">
              {ejercicioAmpliado.nombre}
            </p>
            <p className="text-slate-300 text-center text-sm mt-1">
              Haz clic en cualquier parte para cerrar
            </p>
          </div>
        </div>
      )}

      {ejercicioEditando && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
          <form
            onSubmit={handleActualizarEjercicio}
            className="bg-slate-800 p-6 rounded max-w-md w-full grid grid-cols-1 gap-2"
          >
            <h2 className="text-white text-xl font-bold mb-2">Editar ejercicio</h2>

            <input
              type="text"
              placeholder="Nombre"
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />

            <select
              value={seccionCuerpoIdEdit}
              onChange={(e) => setSeccionCuerpoIdEdit(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            >
              <option value="">Selecciona sección del cuerpo</option>
              {secciones?.map((seccion) => (
                <option key={seccion.id} value={seccion.id}>
                  {seccion.nombre}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Descripción (opcional)"
              value={descripcionEdit}
              onChange={(e) => setDescripcionEdit(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
              rows={2}
            />

            {ejercicioEditando.imagenUrl && (
              <div>
                <p className="text-slate-400 text-xs mb-1">Imagen actual:</p>
                <img
                  src={`http://localhost:3000${ejercicioEditando.imagenUrl}`}
                  alt={ejercicioEditando.nombre}
                  className="w-full h-32 object-contain bg-slate-900 rounded"
                />
              </div>
            )}

            <label className="text-slate-400 text-xs">
              Reemplazar imagen (opcional, deja vacío para conservar la actual):
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImagenEdit(e.target.files ? e.target.files[0] : null)}
              className="p-2 rounded bg-slate-700 text-white"
            />

            <div className="flex gap-2 mt-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() => setEjercicioEditando(null)}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default EjerciciosPage