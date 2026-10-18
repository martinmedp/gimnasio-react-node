import type { GastoRegistro } from '../types/contabilidad'
import { formatearDinero, formatearFechaHora } from '../utils/formato'

interface TablaGastosProps {
  gastos: GastoRegistro[]
  // Muestra la columna que indica si el gasto ya fue cerrado o sigue pendiente
  mostrarCierre?: boolean
  // Opcional: si se pasa, aparece una columna de acciones con el botón
  // Eliminar, solo en los gastos pendientes de cierre. Si no se pasa
  // (como en CierresPage), la tabla se ve exactamente igual que antes
  onEliminar?: (gasto: GastoRegistro) => void
}

// Tabla de gastos reutilizable: la usan la previsualización de un cierre,
// el detalle de un cierre y la pantalla de Gastos. Es la gemela de TablaPagos
function TablaGastos({ gastos, mostrarCierre = false, onEliminar }: TablaGastosProps) {
  if (gastos.length === 0) {
    return <p className="text-slate-400 text-sm">No hay gastos para mostrar.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-white text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="py-2 pr-4">Fecha</th>
            <th className="py-2 pr-4">Categoría</th>
            <th className="py-2 pr-4">Descripción</th>
            <th className="py-2 pr-4">Método</th>
            <th className="py-2 pr-4 text-right">Monto</th>
            <th className="py-2 pr-4">Registrado por</th>
            {mostrarCierre && <th className="py-2 pr-4">Cierre</th>}
            {onEliminar && <th className="py-2">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {gastos.map((gasto) => (
            <tr key={gasto.id} className="border-b border-slate-800 align-top">
              <td className="py-2 pr-4 whitespace-nowrap">{formatearFechaHora(gasto.fecha)}</td>
              <td className="py-2 pr-4">{gasto.categoria.nombre}</td>
              <td className="py-2 pr-4 max-w-xs break-words whitespace-pre-wrap">{gasto.descripcion}</td>
              <td className="py-2 pr-4 capitalize">{gasto.metodoPago}</td>
              <td className="py-2 pr-4 text-right whitespace-nowrap">{formatearDinero(gasto.monto)}</td>
              <td className="py-2 pr-4">{gasto.registradoPor.nombre}</td>
              {mostrarCierre && (
                <td className="py-2 pr-4">
                  {gasto.cierreCajaId ? (
                    <span className="bg-green-700 text-xs px-2 py-1 rounded whitespace-nowrap">
                      Cierre #{gasto.cierreCajaId}
                    </span>
                  ) : (
                    <span className="bg-yellow-600 text-xs px-2 py-1 rounded">Pendiente</span>
                  )}
                </td>
              )}
              {onEliminar && (
                <td className="py-2">
                  {/* Un gasto ya incluido en un cierre no se puede eliminar
                      (el backend también lo rechaza): solo mostramos el
                      botón si sigue pendiente */}
                  {gasto.cierreCajaId ? (
                    <span className="text-slate-500 text-xs">Cerrado</span>
                  ) : (
                    <button
                      onClick={() => onEliminar(gasto)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs"
                    >
                      Eliminar
                    </button>
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

export default TablaGastos