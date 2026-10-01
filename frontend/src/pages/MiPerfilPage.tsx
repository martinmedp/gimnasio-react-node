import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'

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
}

function MiPerfilPage() {
  const { usuario } = useAuth()
  const { notificar } = useNotification()
  const queryClient = useQueryClient()
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  const { data: cliente, isLoading, isError } = useQuery<Cliente>({
    queryKey: ['cliente', usuario?.clienteId],
    queryFn: async () => {
      const response = await api.get(`/clientes/${usuario?.clienteId}`)
      return response.data
    },
    enabled: !!usuario?.clienteId,
  })

  const handleCambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files ? e.target.files[0] : null
    if (!archivo || !usuario?.clienteId) return

    const formData = new FormData()
    formData.append('foto', archivo)

    setSubiendoFoto(true)
    try {
      await api.put(`/clientes/${usuario.clienteId}/foto`, formData)
      queryClient.invalidateQueries({ queryKey: ['cliente', usuario.clienteId] })
      notificar('Foto actualizada correctamente', 'exito')
    } catch (err) {
      notificar('Error al subir la foto', 'error')
    } finally {
      setSubiendoFoto(false)
    }
  }

  if (isLoading) return <p className="text-white">Cargando...</p>
  if (isError || !cliente) return <p className="text-red-400">Error al cargar tu perfil</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-white mb-6">Mi perfil</h1>

      <div className="bg-slate-800 rounded p-6 flex gap-6">
        <div className="flex flex-col items-center gap-2">
          {cliente.fotoUrl ? (
            <img
              src={`http://localhost:3000${cliente.fotoUrl}`}
              alt={cliente.nombre}
              className="w-32 h-32 object-cover rounded-full border-2 border-slate-600"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm text-center">
              Sin foto
            </div>
          )}

          <label
            htmlFor="input-foto"
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 cursor-pointer"
          >
            {subiendoFoto ? 'Subiendo...' : cliente.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
          </label>
          <input
            id="input-foto"
            type="file"
            accept="image/*"
            onChange={handleCambiarFoto}
            className="hidden"
            disabled={subiendoFoto}
          />
        </div>

        <div className="flex-1 text-white space-y-2">
          <p><span className="text-slate-400">Nombre:</span> {cliente.nombre}</p>
          <p><span className="text-slate-400">Documento:</span> {cliente.documento}</p>
          <p><span className="text-slate-400">Teléfono:</span> {cliente.telefono ?? '-'}</p>
          <p><span className="text-slate-400">Email:</span> {cliente.email ?? '-'}</p>
          <p><span className="text-slate-400">Estatura:</span> {cliente.estatura ? `${cliente.estatura} cm` : '-'}</p>
          <p><span className="text-slate-400">Estado:</span> {cliente.estado}</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded p-6 mt-6 flex flex-col items-center">
        <h2 className="text-white font-bold mb-3">Mi código de asistencia</h2>
        <div className="bg-white p-4 rounded">
          <QRCodeSVG value={cliente.documento} size={180} />
        </div>
        <p className="text-slate-400 text-sm mt-3 text-center">
          Muestra este código en recepción para registrar tu entrada al gimnasio.
        </p>
      </div>
    </div>
  )
}

export default MiPerfilPage