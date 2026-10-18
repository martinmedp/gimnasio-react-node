import { useQuery } from '@tanstack/react-query'
// Aquí "Tooltip" es el de recharts (el recuadro que aparece al pasar el
// mouse sobre una barra), no el componente Tooltip propio de la app
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../api'
import TarjetaDato from './TarjetaDato'
import { formatearDinero } from '../utils/formato'

// Forma de la respuesta de GET /estadisticas/finanzas. A diferencia de
// otros endpoints, aquí los montos llegan como NÚMEROS (la librería de
// gráficas los necesita así)
interface MesFinanzas {
  mes: string
  etiqueta: string
  ingresos: number
  gastos: number
  neto: number
}

interface MetodoMes {
  metodoPago: string
  total: number
  cantidad: number
}

interface Finanzas {
  meses: MesFinanzas[]
  mesActual: {
    etiqueta: string
    ingresos: number
    gastos: number
    neto: number
    porMetodo: MetodoMes[]
  }
}

// Color de cada método de pago en la dona; cualquier método nuevo
// que aparezca en el futuro usa el gris
const COLOR_METODO: Record<string, string> = {
  efectivo: '#22c55e',
  tarjeta: '#3b82f6',
  transferencia: '#a855f7',
}
const COLOR_OTRO_METODO = '#94a3b8'

// Formato compacto para los números del eje vertical: 60000 -> "60 mil"
const formatoCompacto = new Intl.NumberFormat('es-CO', { notation: 'compact' })

function DashboardFinanzas() {
  const { data, isLoading, isError } = useQuery<Finanzas>({
    queryKey: ['estadisticas-finanzas'],
    queryFn: async () => {
      const response = await api.get('/estadisticas/finanzas')
      return response.data
    },
  })

  if (isLoading) return <p className="text-white">Cargando estadísticas...</p>
  if (isError || !data) return <p className="text-red-400">No se pudieron cargar las estadísticas financieras</p>

  const { meses, mesActual } = data

  // Datos de la dona. El color va dentro de cada dato (propiedad "fill"),
  // y recharts lo usa para pintar cada porción
  const datosDona = mesActual.porMetodo.map((m) => ({
    name: m.metodoPago.charAt(0).toUpperCase() + m.metodoPago.slice(1),
    value: m.total,
    fill: COLOR_METODO[m.metodoPago] ?? COLOR_OTRO_METODO,
  }))

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-3">Finanzas — {mesActual.etiqueta}</h2>

      {/* Tarjetas del mes en curso */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 max-w-3xl">
        <TarjetaDato titulo="Ingresos del mes" valor={formatearDinero(mesActual.ingresos)} />
        <TarjetaDato titulo="Gastos del mes" valor={formatearDinero(mesActual.gastos)} />
        <TarjetaDato
          titulo="Neto del mes"
          valor={formatearDinero(mesActual.neto)}
          claseValor={mesActual.neto < 0 ? 'text-red-400' : 'text-green-400'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfica de barras: ingresos contra gastos, mes a mes */}
        <div className="bg-slate-800 rounded p-4 lg:col-span-2">
          <h3 className="text-white font-bold text-sm mb-3">Ingresos vs gastos (últimos 6 meses)</h3>
          {/* ResponsiveContainer ocupa el 100% de su contenedor, y por eso
              el contenedor necesita una altura propia (h-72); sin ella la
              gráfica no tendría dónde dibujarse y no aparecería */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={meses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="etiqueta" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => formatoCompacto.format(Number(v))} />
                <Tooltip
                  formatter={(value) => formatearDinero(Number(value))}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569' }}
                  labelStyle={{ color: '#ffffff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend />
                <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dona: de qué método viene el dinero del mes */}
        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-white font-bold text-sm mb-3">Ingresos por método de pago (mes actual)</h3>
          {datosDona.length === 0 ? (
            <p className="text-slate-400 text-sm">Todavía no hay ingresos este mes.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={datosDona} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} />
                  <Tooltip
                    formatter={(value) => formatearDinero(Number(value))}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569' }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardFinanzas