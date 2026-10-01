import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api'

interface HorarioEntrenador {
  id: number
  diaSemana: string
  horaInicio: string
  horaFin: string
}

interface Entrenador {
  id: number
  nombre: string
  especialidad: string | null
  telefono: string | null
  horarios: HorarioEntrenador[]
}

const DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

function EntrenadoresPage() {
  const { usuario } = useAuth()
  const { notificar, confirmar } = useNotification()
  const esAdministrador = usuario?.rol === 'Administrador'
  const queryClient = useQueryClient()

  const [nombre, setNombre] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [telefono, setTelefono] = useState('')

  const [entrenadorAgregandoHorario, setEntrenadorAgregandoHorario] = useState<number | null>(null)
  const [diaHorario, setDiaHorario] = useState('LUNES')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')

  const { data: entrenadores, isLoading, isError } = useQuery<Entrenador[]>({
    queryKey: ['entrenadores'],
    queryFn: async () => {
      const response = await api.get('/entrenadores')
      return response.data
    },
  })

  const handleCrearEntrenador = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre) {
      notificar('El nombre es obligatorio', 'error')
      return
    }

    try {
      await api.post('/entrenadores', { nombre, especialidad, telefono })
      setNombre('')
      setEspecialidad('')
      setTelefono('')
      queryClient.invalidateQueries({ queryKey: ['entrenadores'] })
      notificar('Entrenador agregado correctamente', 'exito')
    } catch (err) {
      notificar('Error al crear el entrenador', 'error')
    }
  }

  const handleEliminarEntrenador = async (id: number) => {
    const confirmado = await confirmar('¿Eliminar este entrenador y todo su horario?', {
      variante: 'peligro',
      textoAceptar: 'Eliminar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/entrenadores/${id}`)
      queryClient.invalidateQueries({ queryKey: ['entrenadores'] })
      notificar('Entrenador eliminado', 'exito')
    } catch (err) {
      notificar('Error al eliminar el entrenador', 'error')
    }
  }

  const abrirAgregarHorario = (entrenadorId: number) => {
    setEntrenadorAgregandoHorario(entrenadorId)
    setDiaHorario('LUNES')
    setHoraInicio('')
    setHoraFin('')
  }

  const handleAgregarHorario = async (e: React.FormEvent, entrenadorId: number) => {
    e.preventDefault()
    if (!horaInicio || !horaFin) {
      notificar('Hora de inicio y fin son obligatorias', 'error')
      return
    }

    try {
      await api.post(`/entrenadores/${entrenadorId}/horarios`, {
        diaSemana: diaHorario,
        horaInicio,
        horaFin,
      })
      setEntrenadorAgregandoHorario(null)
      queryClient.invalidateQueries({ queryKey: ['entrenadores'] })
      notificar('Horario agregado correctamente', 'exito')
    } catch (err) {
      notificar('Error al agregar el horario', 'error')
    }
  }

  const handleQuitarHorario = async (entrenadorId: number, horarioId: number) => {
    const confirmado = await confirmar('¿Quitar este bloque de horario?', {
      variante: 'peligro',
      textoAceptar: 'Quitar',
    })
    if (!confirmado) return

    try {
      await api.delete(`/entrenadores/${entrenadorId}/horarios/${horarioId}`)
      queryClient.invalidateQueries({ queryKey: ['entrenadores'] })
      notificar('Horario eliminado', 'exito')
    } catch (err) {
      notificar('Error al quitar el horario', 'error')
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">
        {esAdministrador ? 'Entrenadores' : 'Disponibilidad de entrenadores'}
      </h1>

      {esAdministrador && (
        <form onSubmit={handleCrearEntrenador} className="grid grid-cols-3 gap-2 mb-8 bg-slate-800 p-4 rounded max-w-2xl">
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="text"
            placeholder="Especialidad (opcional)"
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <input
            type="text"
            placeholder="Teléfono (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="p-2 rounded bg-slate-700 text-white"
          />
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 col-span-3">
            Agregar entrenador
          </button>
        </form>
      )}

      {isLoading && <p className="text-white">Cargando...</p>}
      {isError && <p className="text-red-400">Error al cargar los entrenadores</p>}

      {entrenadores && entrenadores.length === 0 && (
        <p className="text-slate-400">Todavía no hay entrenadores registrados.</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {entrenadores?.map((entrenador) => (
          <div key={entrenador.id} className="bg-slate-800 rounded p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-white font-bold text-lg">{entrenador.nombre}</p>
                {entrenador.especialidad && (
                  <p className="text-slate-400 text-sm">{entrenador.especialidad}</p>
                )}
                {entrenador.telefono && (
                  <p className="text-slate-400 text-sm">{entrenador.telefono}</p>
                )}
              </div>

              {esAdministrador && (
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirAgregarHorario(entrenador.id)}
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs"
                  >
                    + Horario
                  </button>
                  <button
                    onClick={() => handleEliminarEntrenador(entrenador.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-xs"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            {entrenadorAgregandoHorario === entrenador.id && (
              <form
                onSubmit={(e) => handleAgregarHorario(e, entrenador.id)}
                className="grid grid-cols-3 gap-2 mb-3 bg-slate-900 p-3 rounded"
              >
                <select
                  value={diaHorario}
                  onChange={(e) => setDiaHorario(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white col-span-3"
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia} value={dia}>
                      {dia}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white"
                />
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  className="p-2 rounded bg-slate-700 text-white"
                />
                <button type="submit" className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-sm">
                  Agregar
                </button>
              </form>
            )}

            {entrenador.horarios.length === 0 ? (
              <p className="text-slate-500 text-sm">Sin horario asignado.</p>
            ) : (
              <ul className="text-sm text-slate-300 space-y-1">
                {entrenador.horarios.map((horario) => (
                  <li key={horario.id} className="flex justify-between items-center bg-slate-900 px-2 py-1 rounded">
                    <span>
                      <span className="font-bold">{horario.diaSemana}</span>: {horario.horaInicio} - {horario.horaFin}
                    </span>
                    {esAdministrador && (
                      <button
                        onClick={() => handleQuitarHorario(entrenador.id, horario.id)}
                        className="bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 text-xs"
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default EntrenadoresPage