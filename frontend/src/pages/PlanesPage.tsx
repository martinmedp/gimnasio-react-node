import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNotification } from '../context/NotificationContext'
import api from '../api'

interface Plan {
  id: number
  nombre: string
  tipo: string
  precio: string
  duracionDias: number | null
  cantidadEntradas: number | null
}

interface PlanForm {
  nombre: string
  tipo: string
  precio: string
  duracionDias: string
  cantidadEntradas: string
}

const planVacio: PlanForm = { nombre: '', tipo: 'mensual', precio: '', duracionDias: '', cantidadEntradas: '' }

function PlanesPage() {
  const { notificar, confirmar } = useNotification()

  const [nuevoPlan, setNuevoPlan] = useState<PlanForm>(planVacio)
  const [planEditando, setPlanEditando] = useState<Plan | null>(null)
  const [tipoEdit, setTipoEdit] = useState('')
  const [nombreEdit, setNombreEdit] = useState('')
  const [precioEdit, setPrecioEdit] = useState('')
  const [duracionDiasEdit, setDuracionDiasEdit] = useState('')
  const [cantidadEntradasEdit, setCantidadEntradasEdit] = useState('')

  const queryClient = useQueryClient()

  const { data: planes, isLoading, isError } = useQuery<Plan[]>({
    queryKey: ['planes'],
    queryFn: async () => {
      const response = await api.get('/planes')
      return response.data
    },
  })

  const handleCrearPlan = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nuevoPlan.nombre || !nuevoPlan.precio) {
      notificar('Nombre y precio son obligatorios', 'error')
      return
    }

    if (nuevoPlan.tipo === 'tiquetera' && !nuevoPlan.cantidadEntradas) {
      notificar('Un plan de tiquetera requiere la cantidad de entradas', 'error')
      return
    }

    try {
      await api.post('/planes', nuevoPlan)
      setNuevoPlan(planVacio)
      queryClient.invalidateQueries({ queryKey: ['planes'] })
      notificar('Plan creado correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al crear el plan', 'error')
    }
  }

  const abrirEdicion = (plan: Plan) => {
    setPlanEditando(plan)
    setNombreEdit(plan.nombre)
    setTipoEdit(plan.tipo)
    setPrecioEdit(plan.precio)
    setDuracionDiasEdit(plan.duracionDias ? String(plan.duracionDias) : '')
    setCantidadEntradasEdit(plan.cantidadEntradas ? String(plan.cantidadEntradas) : '')
  }

  const handleActualizarPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planEditando) return

    try {
      await api.put(`/planes/${planEditando.id}`, {
        nombre: nombreEdit,
        tipo: tipoEdit,
        precio: precioEdit,
        duracionDias: duracionDiasEdit,
        cantidadEntradas: cantidadEntradasEdit,
      })
      setPlanEditando(null)
      queryClient.invalidateQueries({ queryKey: ['planes'] })
      notificar('Plan actualizado correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al actualizar el plan', 'error')
    }
  }

  const handleEliminarPlan = async (id: number) => {
    const confirmado = await confirmar('¿Eliminar este plan?', {
      variante: 'peligro',
      textoAceptar: 'Eliminar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/planes/${id}`)
      queryClient.invalidateQueries({ queryKey: ['planes'] })
      notificar('Plan eliminado', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al eliminar el plan', 'error')
    }
  }

  const formatearPrecio = (precio: string) => {
    return Number(precio).toLocaleString('es-CO')
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Planes del gimnasio</h1>

      <form onSubmit={handleCrearPlan} className="grid grid-cols-3 gap-2 mb-6 bg-slate-800 p-4 rounded max-w-3xl">
        <input
          type="text"
          placeholder="Nombre (ej. Mensualidad Full)"
          value={nuevoPlan.nombre}
          onChange={(e) => setNuevoPlan({ ...nuevoPlan, nombre: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <select
          value={nuevoPlan.tipo}
          onChange={(e) => setNuevoPlan({ ...nuevoPlan, tipo: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        >
          <option value="mensual">Mensual</option>
          <option value="anual">Anual</option>
          <option value="tiquetera">Tiquetera</option>
        </select>
        <input
          type="number"
          placeholder="Precio"
          value={nuevoPlan.precio}
          onChange={(e) => setNuevoPlan({ ...nuevoPlan, precio: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          placeholder="Duración en días"
          value={nuevoPlan.duracionDias}
          onChange={(e) => setNuevoPlan({ ...nuevoPlan, duracionDias: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        {nuevoPlan.tipo === 'tiquetera' && (
          <input
            type="number"
            placeholder="Cantidad de entradas"
            value={nuevoPlan.cantidadEntradas}
            onChange={(e) => setNuevoPlan({ ...nuevoPlan, cantidadEntradas: e.target.value })}
            className="p-2 rounded bg-slate-700 text-white"
          />
        )}
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 col-span-3">
          Crear plan
        </button>
      </form>

      {planEditando && (
        <form onSubmit={handleActualizarPlan} className="grid grid-cols-3 gap-2 mb-6 bg-slate-800 p-4 rounded max-w-3xl border border-yellow-600">
          <h2 className="text-white font-bold col-span-3">Editando: {planEditando.nombre}</h2>
          <input
            type="text"
            placeholder="Nombre"
            value={nombreEdit}
            onChange={(e) => setNombreEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <select
            value={tipoEdit}
            onChange={(e) => setTipoEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          >
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
            <option value="tiquetera">Tiquetera</option>
          </select>
          <input
            type="number"
            placeholder="Precio"
            value={precioEdit}
            onChange={(e) => setPrecioEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="number"
            placeholder="Duración en días"
            value={duracionDiasEdit}
            onChange={(e) => setDuracionDiasEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          {tipoEdit === 'tiquetera' && (
            <input
              type="number"
              placeholder="Cantidad de entradas"
              value={cantidadEntradasEdit}
              onChange={(e) => setCantidadEntradasEdit(e.target.value)}
              className="p-2 rounded bg-slate-700 text-white"
            />
          )}
          <div className="col-span-3 flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={() => setPlanEditando(null)}
              className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los planes</p>}

      {planes && (
        <table className="w-full text-left text-white">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2">Nombre</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Precio</th>
              <th className="py-2">Duración</th>
              <th className="py-2">Entradas</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {planes.map((plan) => (
              <tr key={plan.id} className="border-b border-slate-800">
                <td className="py-2">{plan.nombre}</td>
                <td className="py-2 capitalize">{plan.tipo}</td>
                <td className="py-2">${formatearPrecio(plan.precio)}</td>
                <td className="py-2">{plan.duracionDias ? `${plan.duracionDias} días` : '-'}</td>
                <td className="py-2">{plan.cantidadEntradas ?? '-'}</td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => abrirEdicion(plan)}
                    className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminarPlan(plan.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default PlanesPage