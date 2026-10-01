import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNotification } from '../context/NotificationContext'
import api from '../api'

interface Rol {
  id: number
  nombre: string
}

interface Cliente {
  id: number
  nombre: string
  documento: string
}

interface Usuario {
  id: number
  nombre: string
  email: string
  activo: boolean
  rol: Rol
  cliente: Cliente | null
}

interface NuevoUsuarioForm {
  nombre: string
  email: string
  password: string
  rolId: string
}

const usuarioVacio: NuevoUsuarioForm = { nombre: '', email: '', password: '', rolId: '' }

function UsuariosPage() {
  const { notificar, confirmar } = useNotification()

  const [nuevoUsuario, setNuevoUsuario] = useState<NuevoUsuarioForm>(usuarioVacio)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [emailEdit, setEmailEdit] = useState('')
  const [passwordEdit, setPasswordEdit] = useState('')
  const [rolIdEdit, setRolIdEdit] = useState('')

  const queryClient = useQueryClient()

  const { data: roles } = useQuery<Rol[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/roles')
      return response.data
    },
  })

  const { data: usuarios, isLoading, isError } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const response = await api.get('/usuarios')
      return response.data
    },
  })

  const rolesDePersonal = roles?.filter((rol) => rol.nombre !== 'Cliente')

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nuevoUsuario.nombre || !nuevoUsuario.email || !nuevoUsuario.password || !nuevoUsuario.rolId) {
      notificar('Todos los campos son obligatorios', 'error')
      return
    }

    try {
      await api.post('/usuarios', nuevoUsuario)
      setNuevoUsuario(usuarioVacio)
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      notificar('Usuario creado correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al crear el usuario', 'error')
    }
  }

  const abrirEdicion = (usuario: Usuario) => {
    setUsuarioEditando(usuario)
    setNombreEdit(usuario.nombre)
    setEmailEdit(usuario.email)
    setPasswordEdit('')
    setRolIdEdit(String(usuario.rol.id))
  }

  const handleActualizarUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuarioEditando) return

    try {
      await api.put(`/usuarios/${usuarioEditando.id}`, {
        nombre: nombreEdit,
        email: emailEdit,
        password: passwordEdit || undefined,
        rolId: rolIdEdit,
      })
      setUsuarioEditando(null)
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      notificar('Usuario actualizado correctamente', 'exito')
    } catch (err: any) {
      notificar(err.response?.data?.error || 'Error al actualizar el usuario', 'error')
    }
  }

  const handleActivar = async (id: number) => {
    try {
      await api.put(`/usuarios/${id}/activar`, {})
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      notificar('Usuario activado correctamente', 'exito')
    } catch (err) {
      notificar('Error al activar el usuario', 'error')
    }
  }

  const handleEliminarUsuario = async (id: number) => {
    const confirmado = await confirmar('¿Eliminar este usuario del sistema?', {
      variante: 'peligro',
      textoAceptar: 'Eliminar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/usuarios/${id}`)
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      notificar('Usuario eliminado', 'exito')
    } catch (err) {
      notificar('Error al eliminar el usuario', 'error')
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Usuarios del sistema</h1>

      <form onSubmit={handleCrearUsuario} className="grid grid-cols-2 gap-2 mb-8 bg-slate-800 p-4 rounded max-w-2xl">
        <h2 className="text-white font-bold col-span-2">Crear usuario de personal</h2>
        <input
          type="text"
          placeholder="Nombre"
          value={nuevoUsuario.nombre}
          onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="email"
          placeholder="Email"
          value={nuevoUsuario.email}
          onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={nuevoUsuario.password}
          onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        />
        <select
          value={nuevoUsuario.rolId}
          onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rolId: e.target.value })}
          className="p-2 rounded bg-slate-700 text-white"
        >
          <option value="">Selecciona un rol</option>
          {rolesDePersonal?.map((rol) => (
            <option key={rol.id} value={rol.id}>
              {rol.nombre}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 col-span-2">
          Crear usuario
        </button>
      </form>

      {usuarioEditando && (
        <form onSubmit={handleActualizarUsuario} className="grid grid-cols-2 gap-2 mb-8 bg-slate-800 p-4 rounded max-w-2xl border border-yellow-600">
          <h2 className="text-white font-bold col-span-2">
            Editando: {usuarioEditando.nombre}
            {usuarioEditando.cliente && (
              <span className="text-slate-400 font-normal text-sm ml-2">
                (documento: {usuarioEditando.cliente.documento})
              </span>
            )}
          </h2>
          <input
            type="text"
            placeholder="Nombre"
            value={nombreEdit}
            onChange={(e) => setNombreEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="email"
            placeholder="Email"
            value={emailEdit}
            onChange={(e) => setEmailEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="password"
            placeholder="Nueva contraseña (dejar vacío para no cambiar)"
            value={passwordEdit}
            onChange={(e) => setPasswordEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <select
            value={rolIdEdit}
            onChange={(e) => setRolIdEdit(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          >
            {roles?.map((rol) => (
              <option key={rol.id} value={rol.id}>
                {rol.nombre}
              </option>
            ))}
          </select>
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={() => setUsuarioEditando(null)}
              className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los usuarios</p>}

      {usuarios && (
        <table className="w-full text-left text-white">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2">Nombre</th>
              <th className="py-2">Email</th>
              <th className="py-2">Rol</th>
              <th className="py-2">Documento (si es Cliente)</th>
              <th className="py-2">Estado</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-b border-slate-800">
                <td className="py-2">{usuario.nombre}</td>
                <td className="py-2">{usuario.email}</td>
                <td className="py-2">{usuario.rol.nombre}</td>
                <td className="py-2">{usuario.cliente?.documento ?? '-'}</td>
                <td className="py-2">
                  {usuario.activo ? (
                    <span className="bg-green-600 text-xs px-2 py-1 rounded">Activo</span>
                  ) : (
                    <span className="bg-yellow-600 text-xs px-2 py-1 rounded">Pendiente</span>
                  )}
                </td>
                <td className="py-2 flex gap-2">
                  {!usuario.activo && (
                    <button
                      onClick={() => handleActivar(usuario.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    onClick={() => abrirEdicion(usuario)}
                    className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminarUsuario(usuario.id)}
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

export default UsuariosPage