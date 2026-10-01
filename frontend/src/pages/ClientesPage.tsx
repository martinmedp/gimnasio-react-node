import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'
import Tooltip from '../components/Tooltip'

interface CuentaVinculada {
  email: string
  activo: boolean
}

interface Cliente {
  id: number
  nombre: string
  documento: string
  telefono: string | null
  email: string | null
  fechaNacimiento: string | null
  estatura: number | null
  fotoUrl: string | null
  estado: string
  alertaMembresia: boolean
  alertaMembresiaVencida: boolean
  usuario: CuentaVinculada | null
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
  const { usuario } = useAuth()
  const { notificar, confirmar } = useNotification()
  const esAdministrador = usuario?.rol === 'Administrador'

  const [nuevoCliente, setNuevoCliente] = useState<NuevoClienteForm>(clienteVacio)
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)
  const [nuevaPasswordEdit, setNuevaPasswordEdit] = useState('')
  const [emailNuevaCuenta, setEmailNuevaCuenta] = useState('')
  const [passwordNuevaCuenta, setPasswordNuevaCuenta] = useState('')

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
      notificar('Cliente agregado correctamente', 'exito')
    } catch (err) {
      notificar('Error al crear el cliente (revisa que el documento no esté repetido)', 'error')
    }
  }

  const abrirEdicion = (cliente: Cliente) => {
    setClienteEditando(cliente)
    setNuevaPasswordEdit('')
    setEmailNuevaCuenta(cliente.email ?? '')
    setPasswordNuevaCuenta('')
  }

  const handleActualizarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteEditando) return

    try {
      await api.put(`/clientes/${clienteEditando.id}`, clienteEditando)
      setClienteEditando(null)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      notificar('Cliente actualizado correctamente', 'exito')
    } catch (err) {
      notificar('Error al actualizar el cliente', 'error')
    }
  }

  // El handler ahora es "async" porque necesitamos "await" para esperar
  // la respuesta del modal de confirmación antes de continuar
  const handleEliminarCliente = async (id: number) => {
    const confirmado = await confirmar('¿Seguro que quieres eliminar este cliente?', {
      variante: 'peligro',
      textoAceptar: 'Eliminar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/clientes/${id}`)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      notificar('Cliente eliminado', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al eliminar el cliente', 'error')
    }
  }

  const handleSeleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>, clienteId: number) => {
    const archivo = e.target.files ? e.target.files[0] : null
    if (!archivo) return

    const formData = new FormData()
    formData.append('foto', archivo)

    try {
      await api.put(`/clientes/${clienteId}/foto`, formData)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    } catch (err) {
      notificar('Error al subir la foto', 'error')
    } finally {
      e.target.value = ''
    }
  }

  const handleCrearCuenta = async () => {
    if (!clienteEditando) return

    if (!emailNuevaCuenta || !passwordNuevaCuenta) {
      notificar('Email y contraseña son obligatorios', 'error')
      return
    }
    if (passwordNuevaCuenta.length < 6) {
      notificar('La contraseña debe tener al menos 6 caracteres', 'error')
      return
    }

    try {
      const response = await api.post(`/clientes/${clienteEditando.id}/cuenta`, {
        email: emailNuevaCuenta,
        password: passwordNuevaCuenta,
      })
      setClienteEditando({ ...clienteEditando, usuario: response.data })
      setPasswordNuevaCuenta('')
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      notificar('Cuenta de acceso creada correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al crear la cuenta de acceso', 'error')
    }
  }

  const handleCambiarEstadoCuenta = async () => {
    if (!clienteEditando?.usuario) return

    const estadoActual = clienteEditando.usuario.activo
    const accion = estadoActual ? 'desactivar' : 'activar'
    const confirmado = await confirmar(`¿Seguro que quieres ${accion} el acceso de este cliente al sistema?`, {
      variante: estadoActual ? 'peligro' : 'normal',
      textoAceptar: estadoActual ? 'Desactivar' : 'Activar',
    })
    if (!confirmado) return

    try {
      await api.put(`/clientes/${clienteEditando.id}/cuenta/estado`, { activo: !estadoActual })
      setClienteEditando({
        ...clienteEditando,
        usuario: { ...clienteEditando.usuario, activo: !estadoActual },
      })
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      notificar(`Cuenta ${estadoActual ? 'desactivada' : 'activada'} correctamente`, 'exito')
    } catch (err) {
      notificar(`Error al ${accion} la cuenta`, 'error')
    }
  }

  const handleRestablecerPassword = async () => {
    if (!clienteEditando) return

    if (!nuevaPasswordEdit || nuevaPasswordEdit.length < 6) {
      notificar('La contraseña debe tener al menos 6 caracteres', 'error')
      return
    }

    try {
      await api.put(`/clientes/${clienteEditando.id}/cuenta/password`, { password: nuevaPasswordEdit })
      notificar('Contraseña actualizada correctamente', 'exito')
      setNuevaPasswordEdit('')
    } catch (err) {
      notificar('Error al restablecer la contraseña', 'error')
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

          {esAdministrador && (
            <div className="col-span-3 border-t border-slate-600 pt-3 mt-1">
              {clienteEditando.usuario ? (
                <>
                  <p className="text-slate-400 text-sm mb-2">
                    Cuenta de acceso: {clienteEditando.usuario.email} —{' '}
                    <span className={clienteEditando.usuario.activo ? 'text-green-400' : 'text-yellow-400'}>
                      {clienteEditando.usuario.activo ? 'Activa' : 'Pendiente'}
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <button
                      type="button"
                      onClick={handleCambiarEstadoCuenta}
                      className={`px-3 py-2 rounded text-sm text-white ${clienteEditando.usuario.activo
                          ? 'bg-orange-600 hover:bg-orange-700'
                          : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                      {clienteEditando.usuario.activo ? 'Desactivar acceso' : 'Activar acceso'}
                    </button>
                    <input
                      type="password"
                      placeholder="Nueva contraseña"
                      value={nuevaPasswordEdit}
                      onChange={(e) => setNuevaPasswordEdit(e.target.value)}
                      className="p-2 rounded bg-slate-700 text-white"
                    />
                    <button
                      type="button"
                      onClick={handleRestablecerPassword}
                      className="bg-slate-600 text-white px-3 py-2 rounded hover:bg-slate-700 text-sm"
                    >
                      Restablecer clave
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm mb-2">
                    Este cliente no tiene cuenta de acceso. Puedes crearle una ahora — quedará activa de inmediato.
                  </p>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <input
                      type="email"
                      placeholder="Email para la cuenta"
                      value={emailNuevaCuenta}
                      onChange={(e) => setEmailNuevaCuenta(e.target.value)}
                      className="p-2 rounded bg-slate-700 text-white"
                    />
                    <input
                      type="password"
                      placeholder="Contraseña (mín. 6 caracteres)"
                      value={passwordNuevaCuenta}
                      onChange={(e) => setPasswordNuevaCuenta(e.target.value)}
                      className="p-2 rounded bg-slate-700 text-white"
                    />
                    <button
                      type="button"
                      onClick={handleCrearCuenta}
                      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                    >
                      Crear cuenta de acceso
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="col-span-3 flex gap-2 mt-2">
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
              <th className="py-2">Foto</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Documento</th>
              <th className="py-2">Teléfono</th>
              <th className="py-2">Cuenta</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id} className="border-b border-slate-800">
                <td className="py-2">
                  <label htmlFor={`foto-${cliente.id}`} className="cursor-pointer block" title="Cambiar foto">
                    {cliente.fotoUrl ? (
                      <img
                        src={`http://localhost:3000${cliente.fotoUrl}`}
                        alt={cliente.nombre}
                        className="w-10 h-10 object-cover rounded-full hover:opacity-75 transition"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs hover:bg-slate-600 transition">
                        +
                      </div>
                    )}
                  </label>
                  <input
                    id={`foto-${cliente.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleSeleccionarFoto(e, cliente.id)}
                  />
                </td>
                <td className="py-2">
                  {cliente.alertaMembresiaVencida ? (
                    <Tooltip texto="Membresía vencida" variante="rojo">
                      <span className="font-bold text-red-500">{cliente.nombre}</span>
                    </Tooltip>
                  ) : cliente.alertaMembresia ? (
                    <Tooltip texto="Membresía próxima a vencer" variante="naranja">
                      <span className="font-bold text-orange-400">{cliente.nombre}</span>
                    </Tooltip>
                  ) : (
                    cliente.nombre
                  )}
                </td>
                <td className="py-2">{cliente.documento}</td>
                <td className="py-2">{cliente.telefono ?? '-'}</td>
                <td className="py-2">
                  {!cliente.usuario ? (
                    <span className="text-slate-500 text-xs">Sin cuenta</span>
                  ) : cliente.usuario.activo ? (
                    <span className="bg-green-600 text-xs px-2 py-1 rounded">Activa</span>
                  ) : (
                    <span className="bg-yellow-600 text-xs px-2 py-1 rounded">Pendiente</span>
                  )}
                </td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => abrirEdicion(cliente)}
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
                  <Link
                    to={`/clientes/${cliente.id}/membresia`}
                    className="bg-teal-600 text-white px-3 py-1 rounded hover:bg-teal-700 text-sm"
                  >
                    Membresía
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