import type { PagoRegistro, ResumenMetodo } from '../types/contabilidad'
import { formatearDinero, formatearFechaHora } from '../utils/formato'

interface TablaPagosProps {
  pagos: PagoRegistro[]
  // Muestra la columna de estado: anulado, ya cerrado o pendiente
  mostrarCierre?: boolean
}

// Tabla de pagos reutilizable: la usan la pantalla de Pagos, la
// previsualización de un cierre y el detalle de un cierre
function TablaPagos({ pagos, mostrarCierre = false }: TablaPagosProps) {
  if (pagos.length === 0) {
    return <p className="text-slate-400 text-sm">No hay pagos para mostrar.</p>
  }

  return (
    // overflow-x-auto: si la tabla es más ancha que la pantalla, hace scroll
    // dentro de este contenedor en vez de romper todo el diseño
    <div className="overflow-x-auto">
      <table className="w-full text-left text-white text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="py-2 pr-4">Fecha</th>
            <th className="py-2 pr-4">Cliente</th>
            <th className="py-2 pr-4">Plan</th>
            <th className="py-2 pr-4">Método</th>
            <th className="py-2 pr-4 text-right">Monto</th>
            <th className="py-2 pr-4">Registrado por</th>
            {mostrarCierre && <th className="py-2">Estado</th>}
          </tr>
        </thead>
        <tbody>
          {pagos.map((pago) => (
            // Un pago anulado se ve atenuado y con el monto tachado: sigue
            // en la lista como rastro, pero se nota que no cuenta
            <tr key={pago.id} className={`border-b border-slate-800 align-top ${pago.anulado ? 'opacity-60' : ''}`}>
              <td className="py-2 pr-4 whitespace-nowrap">{formatearFechaHora(pago.fecha)}</td>
              <td className="py-2 pr-4">
                {pago.membresia.cliente.nombre}
                <span className="block text-slate-500 text-xs">{pago.membresia.cliente.documento}</span>
              </td>
              <td className="py-2 pr-4">{pago.membresia.plan.nombre}</td>
              <td className="py-2 pr-4 capitalize">{pago.metodoPago}</td>
              <td className={`py-2 pr-4 text-right whitespace-nowrap ${pago.anulado ? 'line-through' : ''}`}>
                {formatearDinero(pago.monto)}
              </td>
              <td className="py-2 pr-4">{pago.registradoPor.nombre}</td>
              {mostrarCierre && (
                <td className="py-2">
                  {pago.anulado ? (
                    <>
                      <span className="bg-red-700 text-xs px-2 py-1 rounded">Anulado</span>
                      {pago.motivoAnulacion && (
                        <span className="block text-red-300 text-xs mt-1 max-w-[12rem] break-words">
                          {pago.motivoAnulacion}
                        </span>
                      )}
                    </>
                  ) : pago.cierreCajaId ? (
                    <span className="bg-green-700 text-xs px-2 py-1 rounded whitespace-nowrap">
                      Cierre #{pago.cierreCajaId}
                    </span>
                  ) : (
                    <span className="bg-yellow-600 text-xs px-2 py-1 rounded">Pendiente</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Etiquetas con el desglose de un total por método de pago,
// por ejemplo: "Efectivo: $240.000 (3)"
export function ChipsMetodo({ porMetodo }: { porMetodo: ResumenMetodo[] }) {
  if (porMetodo.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {porMetodo.map((metodo) => (
        <span
          key={metodo.metodoPago}
          className="bg-slate-700 text-slate-200 text-sm px-3 py-1 rounded capitalize"
        >
          {metodo.metodoPago}: {formatearDinero(metodo.total)} ({metodo.cantidad})
        </span>
      ))}
    </div>
  )
}

export default TablaPagos