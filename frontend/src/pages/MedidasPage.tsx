import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import { formatearFecha } from '../utils/formato'

interface Cliente {
  id: number
  nombre: string
  documento: string
  // Necesaria para saber si el IMC se puede calcular (el backend lo calcula
  // con peso y estatura, y la estatura vive en la ficha del cliente)
  estatura: number | null
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
  const { usuario } = useAuth()
  const { notificar, confirmar } = useNotification()

  // El Cliente llega aquí desde su propio menú ("Mi progreso"); el personal
  // llega desde la tabla de Clientes. La pantalla se adapta a cada caso
  const esCliente = usuario?.rol === 'Cliente'
  // Eliminar medidas sigue siendo solo del personal (el backend también lo exige)
  const puedeEliminar = usuario?.rol === 'Administrador' || usuario?.rol === 'Entrenador'

  const [nuevaMedida, setNuevaMedida] = useState<NuevaMedidaForm>(medidaVacia)
  const queryClient = useQueryClient()

  const { data: cliente } = useQuery<Cliente>({
    queryKey: ['cliente', id],
    queryFn: async () => {
      const response = await api.get(`/clientes/${id}`)
      return response.data
    },
  })

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
      notificar('Medición registrada correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al registrar la medida', 'error')
    }
  }

  const handleEliminarMedida = async (medidaId: number) => {
    const confirmado = await confirmar('¿Eliminar este registro de medida?', {
      variante: 'peligro',
      textoAceptar: 'Eliminar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/medidas/${medidaId}`)
      queryClient.invalidateQueries({ queryKey: ['medidas', id] })
      notificar('Medida eliminada', 'exito')
    } catch (err) {
      notificar('Error al eliminar la medida', 'error')
    }
  }

  return (
    <div>
      {/* "Volver a clientes" solo tiene sentido para el personal: el Cliente
          no tiene acceso a esa lista */}
      {!esCliente && (
        <Link to="/clientes" className="text-slate-400 hover:text-white text-sm mb-4 inline-block">
          ← Volver a clientes
        </Link>
      )}

      <h1 className="text-3xl font-bold text-white mb-1">
        {esCliente ? 'Mi progreso físico' : `Progreso físico de ${cliente ? cliente.nombre : 'Cargando...'}`}
      </h1>
      {cliente && !esCliente && <p className="text-slate-400 mb-6">Documento: {cliente.documento}</p>}
      {esCliente && <div className="mb-6" />}

      {/* Aviso cuando falta la estatura: sin ella el IMC no se puede calcular.
          Solo aparece cuando ya cargó el cliente y la estatura está vacía */}
      {cliente && !cliente.estatura && (
        <p className="bg-yellow-900/30 border border-yellow-700 text-yellow-200 text-sm rounded p-3 mb-6 max-w-3xl">
          {esCliente
            ? 'Tu estatura todavía no está registrada, por eso no se calcula tu IMC. Pídele al personal del gimnasio que la registre.'
            : 'Este cliente no tiene estatura registrada, por eso el IMC no se calcula. Puedes agregarla en Clientes → Editar.'}
        </p>
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
        <p className="text-slate-400">
          {esCliente
            ? 'Todavía no has registrado mediciones.'
            : 'Este cliente todavía no tiene mediciones registradas.'}
        </p>
      )}

      {medidas && medidas.length > 0 && (
        <div className="overflow-x-auto">
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
                {/* La columna de acciones solo existe para quien puede eliminar */}
                {puedeEliminar && <th className="py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {medidas.map((medida) => (
                <tr key={medida.id} className="border-b border-slate-800">
                  {/* formatearFecha convierte a hora local; fecha.substring(0, 10)
                      mostraba la fecha en UTC, y una medición hecha de noche
                      aparecía con la fecha del día siguiente */}
                  <td className="py-2 pr-4 whitespace-nowrap">{formatearFecha(medida.fecha)}</td>
                  <td className="py-2 pr-4">{medida.peso ?? '-'}</td>
                  <td className="py-2 pr-4">{medida.imc ?? '-'}</td>
                  <td className="py-2 pr-4">{medida.porcentajeGrasa ?? '-'}</td>
                  <td className="py-2 pr-4">{medida.circunferenciaCintura ?? '-'}</td>
                  <td className="py-2 pr-4">{medida.circunferenciaCadera ?? '-'}</td>
                  <td className="py-2 pr-4">{medida.circunferenciaBrazo ?? '-'}</td>
                  <td className="py-2 pr-4">{medida.circunferenciaMuslo ?? '-'}</td>
                  {puedeEliminar && (
                    <td className="py-2">
                      <button
                        onClick={() => handleEliminarMedida(medida.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs"
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MedidasPage