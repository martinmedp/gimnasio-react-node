import { useQuery } from '@tanstack/react-query'
// Aquí "Tooltip" es el de recharts (el recuadro al pasar el mouse sobre
// un punto o barra), no el componente Tooltip propio de la app
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../api'
import TarjetaDato from './TarjetaDato'

// Mismos contadores que ya usa AsistenciaPage
interface Contador {
  hoy: number
  semana: number
  mes: number
  total: number
}

interface PuntoDia {
  fecha: string
  etiqueta: string
  entradas: number
}

interface PuntoDiaSemana {
  dia: string
  entradas: number
}

interface PuntoHora {
  hora: number
  etiqueta: string
  entradas: number
}

// Forma de la respuesta de GET /estadisticas/asistencia
interface EstadisticasAsistencia {
  dias: number
  porDia: PuntoDia[]
  porDiaSemana: PuntoDiaSemana[]
  porHora: PuntoHora[]
}

// Estilos compartidos por las tres gráficas, para que se vean iguales
const ESTILO_TOOLTIP = { backgroundColor: '#0f172a', border: '1px solid #475569' }
const ESTILO_ETIQUETA_TOOLTIP = { color: '#ffffff' }
const ESTILO_EJE = { fill: '#94a3b8', fontSize: 12 }

function DashboardAsistencia() {
  // Misma queryKey que usa AsistenciaPage para "todo el gimnasio": al
  // compartirla, las dos pantallas comparten el resultado guardado
  const { data: contador } = useQuery<Contador>({
    queryKey: ['asistencias-contador', ''],
    queryFn: async () => {
      const response = await api.get('/asistencias/contador')
      return response.data
    },
  })

  const { data, isLoading, isError } = useQuery<EstadisticasAsistencia>({
    queryKey: ['estadisticas-asistencia'],
    queryFn: async () => {
      const response = await api.get('/estadisticas/asistencia')
      return response.data
    },
  })

  if (isLoading) return <p className="text-white">Cargando estadísticas de asistencia...</p>
  if (isError || !data) return <p className="text-red-400">No se pudieron cargar las estadísticas de asistencia</p>

  // Datos destacados, calculados a partir de lo que ya llegó. reduce
  // recorre la lista guardando el elemento con más entradas hasta el momento
  const totalPeriodo = data.porDia.reduce((suma, d) => suma + d.entradas, 0)
  const diaTop = data.porDiaSemana.reduce((mejor, d) => (d.entradas > mejor.entradas ? d : mejor), data.porDiaSemana[0])
  const horaTop = data.porHora.reduce((mejor, h) => (h.entradas > mejor.entradas ? h : mejor), data.porHora[0])

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-3">Asistencia</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-3xl">
        <TarjetaDato titulo="Entradas hoy" valor={contador ? String(contador.hoy) : '-'} />
        <TarjetaDato titulo="Esta semana" valor={contador ? String(contador.semana) : '-'} />
        <TarjetaDato titulo="Este mes" valor={contador ? String(contador.mes) : '-'} />
        <TarjetaDato titulo="Total histórico" valor={contador ? String(contador.total) : '-'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Línea: entradas día a día, últimos 30 días (ocupa el ancho completo) */}
        <div className="bg-slate-800 rounded p-4 lg:col-span-2">
          <h3 className="text-white font-bold text-sm">Entradas por día (últimos {data.dias} días)</h3>
          <p className="text-slate-400 text-xs mb-3">Total del periodo: {totalPeriodo} entradas</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.porDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                {/* minTickGap evita que las 30 etiquetas se amontonen:
                    recharts omite las que no caben */}
                <XAxis dataKey="etiqueta" tick={ESTILO_EJE} interval="preserveStartEnd" minTickGap={24} />
                {/* allowDecimals={false}: son conteos, no existe "1,5 entradas" */}
                <YAxis allowDecimals={false} tick={ESTILO_EJE} />
                <Tooltip contentStyle={ESTILO_TOOLTIP} labelStyle={ESTILO_ETIQUETA_TOOLTIP} />
                <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Barras: qué días de la semana hay más movimiento */}
        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-white font-bold text-sm">Entradas por día de la semana</h3>
          <p className="text-slate-400 text-xs mb-3">
            {diaTop.entradas > 0
              ? `Día más concurrido: ${diaTop.dia} (${diaTop.entradas} entradas)`
              : 'Todavía no hay entradas en este periodo'}
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.porDiaSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" tick={ESTILO_EJE} />
                <YAxis allowDecimals={false} tick={ESTILO_EJE} />
                <Tooltip
                  contentStyle={ESTILO_TOOLTIP}
                  labelStyle={ESTILO_ETIQUETA_TOOLTIP}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="entradas" name="Entradas" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Barras: horas pico del día (formato de 24 horas) */}
        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-white font-bold text-sm">Entradas por hora (horas pico)</h3>
          <p className="text-slate-400 text-xs mb-3">
            {horaTop.entradas > 0
              ? `Hora más concurrida: ${horaTop.etiqueta} (${horaTop.entradas} entradas)`
              : 'Todavía no hay entradas en este periodo'}
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.porHora}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="etiqueta" tick={ESTILO_EJE} />
                <YAxis allowDecimals={false} tick={ESTILO_EJE} />
                <Tooltip
                  contentStyle={ESTILO_TOOLTIP}
                  labelStyle={ESTILO_ETIQUETA_TOOLTIP}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="entradas" name="Entradas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardAsistencia