import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'

interface CategoriaGasto {
  id: number
  nombre: string
}

function CategoriasGastoPage() {
  const { usuario } = useAuth()
  const { notificar, confirmar } = useNotification()
  const queryClient = useQueryClient()

  // Mismos roles que gestionan gastos en el backend
  const puedeGestionar = usuario?.rol === 'Administrador' || usuario?.rol === 'Recepcionista'

  const [nombreNueva, setNombreNueva] = useState('')

  // Edición en línea: guardamos cuál fila se está editando y su texto.
  // null = ninguna fila en edición
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')

  const { data: categorias, isLoading, isError } = useQuery<CategoriaGasto[]>({
    queryKey: ['categorias-gasto'],
    queryFn: async () => {
      const response = await api.get('/categorias-gasto')
      return response.data
    },
    enabled: puedeGestionar,
  })

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombreNueva.trim()) {
      notificar('El nombre es obligatorio', 'error')
      return
    }

    try {
      await api.post('/categorias-gasto', { nombre: nombreNueva.trim() })
      setNombreNueva('')
      queryClient.invalidateQueries({ queryKey: ['categorias-gasto'] })
      notificar('Categoría creada correctamente', 'exito')
    } catch (err: any) {
      // El backend responde 409 si ya existe una categoría con ese nombre
      notificar(err.response?.data?.error || 'Error al crear la categoría', 'error')
    }
  }

  const abrirEdicion = (categoria: CategoriaGasto) => {
    setEditandoId(categoria.id)
    setNombreEdit(categoria.nombre)
  }

  const handleGuardarEdicion = async (id: number) => {
    if (!nombreEdit.trim()) {
      notificar('El nombre es obligatorio', 'error')
      return
    }

    try {
      await api.put(`/categorias-gasto/${id}`, { nombre: nombreEdit.trim() })
      setEditandoId(null)
      queryClient.invalidateQueries({ queryKey: ['categorias-gasto'] })
      notificar('Categoría actualizada correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al actualizar la categoría', 'error')
    }
  }

  const handleEliminar = async (categoria: CategoriaGasto) => {
    const confirmado = await confirmar(`¿Eliminar la categoría "${categoria.nombre}"?`, {
      variante: 'peligro',
      textoAceptar: 'Eliminar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/categorias-gasto/${categoria.id}`)
      queryClient.invalidateQueries({ queryKey: ['categorias-gasto'] })
      notificar('Categoría eliminada', 'exito')
    } catch (err: any) {
      // Si la categoría ya tiene gastos, el backend responde 409 con un
      // mensaje claro ("tiene gastos asociados") y lo mostramos tal cual
      notificar(err.response?.data?.error || 'Error al eliminar la categoría', 'error')
    }
  }

  // Todos los hooks ya se llamaron arriba; este return anticipado es seguro
  if (!puedeGestionar) {
    return <p className="text-red-400">No tienes acceso a esta sección.</p>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Categorías de gasto</h1>

      <form onSubmit={handleCrear} className="flex gap-2 mb-6 bg-slate-800 p-4 rounded max-w-xl">
        <input
          type="text"
          placeholder="Nombre de la categoría (ej. Mantenimiento)"
          value={nombreNueva}
          onChange={(e) => setNombreNueva(e.target.value)}
          className="p-2 rounded bg-slate-700 text-white flex-1"
        />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Agregar
        </button>
      </form>

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar las categorías</p>}

      {categorias && categorias.length === 0 && (
        <p className="text-slate-400">Todavía no hay categorías. Crea la primera arriba.</p>
      )}

      {categorias && categorias.length > 0 && (
        <table className="w-full max-w-xl text-left text-white">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2">Nombre</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => (
              <tr key={categoria.id} className="border-b border-slate-800">
                <td className="py-2 pr-4">
                  {editandoId === categoria.id ? (
                    <input
                      type="text"
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      className="p-1 rounded bg-slate-700 text-white w-full"
                      autoFocus
                    />
                  ) : (
                    categoria.nombre
                  )}
                </td>
                <td className="py-2 flex gap-2">
                  {editandoId === categoria.id ? (
                    <>
                      <button
                        onClick={() => handleGuardarEdicion(categoria.id)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="bg-slate-600 text-white px-3 py-1 rounded hover:bg-slate-700 text-sm"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => abrirEdicion(categoria)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(categoria)}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default CategoriasGastoPage