import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api'

interface Cliente {
  id: number
  nombre: string
  documento: string
}

interface MedidaCorporal {
  id: number
  clienteId: number
  fecha: string
  peso: number | null
  imc: number | null
  porcentajeGrasa: number | null
  circunferenciaPecho: number | null
  circunferenciaCintura: number | null
  circunferenciaCadera: number | null
  circunferenciaBrazo: number | null
  circunferenciaMuslo: number | null
  circunferenciaPantorrilla: number | null
  circunferenciaCuello: number | null
  notas: string | null
}

interface NuevaMedidaForm {
  peso: string
  porcentajeGrasa: string
  circunferenciaPecho: string
  circunferenciaCintura: string
  circunferenciaCadera: string
  circunferenciaBrazo: string
  circunferenciaMuslo: string
  circunferenciaPantorrilla: string
  circunferenciaCuello: string
  notas: string
}

const medidaVacia: NuevaMedidaForm = {
  peso: '',
  porcentajeGrasa: '',
  circunferenciaPecho: '',
  circunferenciaCintura: '',
  circunferenciaCadera: '',
  circunferenciaBrazo: '',
  circunferenciaMuslo: '',
  circunferenciaPantorrilla: '',
  circunferenciaCuello: '',
  notas: '',
}

function MedidasPage() {
  const { id } = useParams<{ id: string }>()

  const [nuevaMedida, setNuevaMedida] = useState<NuevaMedidaForm>(medidaVacia)
  const queryClient = useQueryClient()

  // Trae los datos del cliente (nombre, documento) para mostrarlos como encabezado
  const { data: cliente } = useQuery<Cliente>({
    queryKey: ['cliente', id],
    queryFn: async () => {
      const response = await api.get(`/clientes/${id}`)
      return response.data
    },
  })

  // Trae el historial de medidas de este cliente, ya con el IMC calculado
  // desde el backend (usa la estatura del cliente + el peso de cada medida)
  const { data: medidas, isLoading, isError } = useQuery<MedidaCorporal[]>({
    queryKey: ['medidas', id],
    queryFn: async () => {
      const response = await api.get(`/medidas/cliente/${id}`)
      return response.data
    },
  })

  const handleRegistrarMedida = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/medidas', { ...nuevaMedida, clienteId: id })
      setNuevaMedida(medidaVacia)
      queryClient.invalidateQueries({ queryKey: ['medidas', id] })
    } catch (err) {
      alert('Error al registrar la medida')
    }
  }

  const handleEliminarMedida = async (medidaId: number) => {
    if (!confirm('¿Eliminar este registro de medida?')) return
    try {
      await api.delete(`/medidas/${medidaId}`)
      queryClient.invalidateQueries({ queryKey: ['medidas', id] })
    } catch (err) {
      alert('Error al eliminar la medida')
    }
  }

  return (
    <div>
      <Link to="/clientes" className="text-slate-400 hover:text-white text-sm mb-4 inline-block">
        ← Volver a clientes
      </Link>

      <h1 className="text-3xl font-bold text-white mb-1">
        Progreso físico de {cliente ? cliente.nombre : 'Cargando...'}
      </h1>
      {cliente && (
        <p className="text-slate-400 mb-6">Documento: {cliente.documento}</p>
      )}

      <form onSubmit={handleRegistrarMedida} className="grid grid-cols-3 gap-2 mb-6 bg-slate-800 p-4 rounded max-w-3xl">
        <input
          type="number"
          step="0.1"
          placeholder="Peso (kg)"
          value={nuevaMedida.peso}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, peso: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="% Grasa corporal"
          value={nuevaMedida.porcentajeGrasa}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, porcentajeGrasa: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Cuello (cm)"
          value={nuevaMedida.circunferenciaCuello}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, circunferenciaCuello: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Pecho (cm)"
          value={nuevaMedida.circunferenciaPecho}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, circunferenciaPecho: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Cintura (cm)"
          value={nuevaMedida.circunferenciaCintura}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, circunferenciaCintura: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Cadera (cm)"
          value={nuevaMedida.circunferenciaCadera}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, circunferenciaCadera: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Brazo (cm)"
          value={nuevaMedida.circunferenciaBrazo}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, circunferenciaBrazo: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Muslo (cm)"
          value={nuevaMedida.circunferenciaMuslo}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, circunferenciaMuslo: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Pantorrilla (cm)"
          value={nuevaMedida.circunferenciaPantorrilla}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, circunferenciaPantorrilla: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <textarea
          placeholder="Notas (opcional)"
          value={nuevaMedida.notas}
          onChange={(e) => setNuevaMedida({ ...nuevaMedida, notas: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white col-span-3"
          rows={2}
        />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 col-span-3">
          Registrar medición
        </button>
      </form>

      {isLoading && <p className="text-white">Cargando historial...</p>}
      {isError && <p className="text-red-400">Error al cargar las medidas</p>}

      {medidas && medidas.length === 0 && (
        <p className="text-slate-400">Este cliente todavía no tiene mediciones registradas.</p>
      )}

      {medidas && medidas.length > 0 && (
        <table className="w-full text-left text-white text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Peso</th>
              <th className="py-2 pr-4">IMC</th>
              <th className="py-2 pr-4">% Grasa</th>
              <th className="py-2 pr-4">Cintura</th>
              <th className="py-2 pr-4">Cadera</th>
              <th className="py-2 pr-4">Brazo</th>
              <th className="py-2 pr-4">Muslo</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {medidas.map((medida) => (
              <tr key={medida.id} className="border-b border-slate-800">
                <td className="py-2 pr-4">{medida.fecha.substring(0, 10)}</td>
                <td className="py-2 pr-4">{medida.peso ?? '-'}</td>
                <td className="py-2 pr-4">{medida.imc ?? '-'}</td>
                <td className="py-2 pr-4">{medida.porcentajeGrasa ?? '-'}</td>
                <td className="py-2 pr-4">{medida.circunferenciaCintura ?? '-'}</td>
                <td className="py-2 pr-4">{medida.circunferenciaCadera ?? '-'}</td>
                <td className="py-2 pr-4">{medida.circunferenciaBrazo ?? '-'}</td>
                <td className="py-2 pr-4">{medida.circunferenciaMuslo ?? '-'}</td>
                <td className="py-2">
                  <button
                    onClick={() => handleEliminarMedida(medida.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs"
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

export default MedidasPage