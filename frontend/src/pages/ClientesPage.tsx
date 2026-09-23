import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../api'

interface Cliente {
  id: number
  nombre: string
  documento: string
  telefono: string | null
  email: string | null
  fechaNacimiento: string | null
  estatura: number | null
  estado: string
}

interface NuevoClienteForm {
  nombre: string
  documento: string
  telefono: string
  email: string
  fechaNacimiento: string
  estatura: string
}

const clienteVacio: NuevoClienteForm = {
  nombre: '',
  documento: '',
  telefono: '',
  email: '',
  fechaNacimiento: '',
  estatura: '',
}

function ClientesPage() {
  const [nuevoCliente, setNuevoCliente] = useState<NuevoClienteForm>(clienteVacio)
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)

  const queryClient = useQueryClient()

  const { data: clientes, isLoading, isError } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: async () => {
      const response = await api.get('/clientes')
      return response.data
    },
  })

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/clientes', nuevoCliente)
      setNuevoCliente(clienteVacio)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    } catch (err) {
      alert('Error al crear el cliente (revisa que el documento no esté repetido)')
    }
  }

  const handleActualizarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteEditando) return

    try {
      await api.put(`/clientes/${clienteEditando.id}`, clienteEditando)
      setClienteEditando(null)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    } catch (err) {
      alert('Error al actualizar el cliente')
    }
  }

  const handleEliminarCliente = async (id: number) => {
    if (!confirm('¿Seguro que quieres eliminar este cliente?')) return

    try {
      await api.delete(`/clientes/${id}`)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar el cliente')
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Clientes del gimnasio</h1>

      <form onSubmit={handleCrearCliente} className="grid grid-cols-3 gap-2 mb-6 bg-slate-800 p-4 rounded max-w-3xl">
        <input
          type="text"
          placeholder="Nombre"
          value={nuevoCliente.nombre}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="text"
          placeholder="Documento"
          value={nuevoCliente.documento}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, documento: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="text"
          placeholder="Teléfono"
          value={nuevoCliente.telefono}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="email"
          placeholder="Email"
          value={nuevoCliente.email}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="date"
          value={nuevoCliente.fechaNacimiento}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, fechaNacimiento: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Estatura (cm)"
          value={nuevoCliente.estatura}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, estatura: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 col-span-3">
          Agregar cliente
        </button>
      </form>

      {clienteEditando && (
        <form onSubmit={handleActualizarCliente} className="grid grid-cols-3 gap-2 mb-6 bg-slate-800 p-4 rounded max-w-3xl">
          <input
            type="text"
            placeholder="Nombre"
            value={clienteEditando.nombre}
            onChange={(e) => setClienteEditando({ ...clienteEditando, nombre: e.target.value })}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="text"
            placeholder="Documento"
            value={clienteEditando.documento}
            onChange={(e) => setClienteEditando({ ...clienteEditando, documento: e.target.value })}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="text"
            placeholder="Teléfono"
            value={clienteEditando.telefono ?? ''}
            onChange={(e) => setClienteEditando({ ...clienteEditando, telefono: e.target.value })}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="email"
            placeholder="Email"
            value={clienteEditando.email ?? ''}
            onChange={(e) => setClienteEditando({ ...clienteEditando, email: e.target.value })}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="date"
            value={clienteEditando.fechaNacimiento?.substring(0, 10) ?? ''}
            onChange={(e) => setClienteEditando({ ...clienteEditando, fechaNacimiento: e.target.value })}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Estatura (cm)"
            value={clienteEditando.estatura ?? ''}
            onChange={(e) => setClienteEditando({ ...clienteEditando, estatura: Number(e.target.value) })}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <div className="col-span-3 flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={() => setClienteEditando(null)}
              className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los clientes</p>}

      {clientes && (
        <table className="w-full text-left text-white">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2">ID</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Documento</th>
              <th className="py-2">Teléfono</th>
              <th className="py-2">Email</th>
              <th className="py-2">Estatura</th>
              <th className="py-2">Estado</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id} className="border-b border-slate-800">
                <td className="py-2">{cliente.id}</td>
                <td className="py-2">{cliente.nombre}</td>
                <td className="py-2">{cliente.documento}</td>
                <td className="py-2">{cliente.telefono ?? '-'}</td>
                <td className="py-2">{cliente.email ?? '-'}</td>
                <td className="py-2">{cliente.estatura ? `${cliente.estatura} cm` : '-'}</td>
                <td className="py-2">{cliente.estado}</td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => setClienteEditando(cliente)}
                    className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                  >
                    Editar
                  </button>
                  <Link
                    to={`/clientes/${cliente.id}/medidas`}
                    className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm"
                  >
                    Progreso
                  </Link>
                  <Link
                    to={`/clientes/${cliente.id}/rutinas`}
                    className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm"
                  >
                    Rutinas
                  </Link>
                  <button
                    onClick={() => handleEliminarCliente(cliente.id)}
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

export default ClientesPage