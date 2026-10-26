// Tipos compartidos por las pantallas y componentes de contabilidad.
// Recuerda: al importarlos desde otro archivo se usa "import type",
// igual que pasó con ReactNode

export interface ResumenMetodo {
  metodoPago: string
  total: string
  cantidad: number
}

// Totales calculados por el backend (resumirPagos)
export interface Resumen {
  totalGeneral: string
  totalEfectivo: string
  cantidad: number
  porMetodo: ResumenMetodo[]
}

export interface PagoRegistro {
  id: number
  monto: string
  fecha: string
  metodoPago: string
  // null = pendiente de cierre; con valor = id del cierre que lo incluyó
  cierreCajaId: number | null
  registradoPor: { nombre: string }
  membresia: {
    cliente: { nombre: string; documento: string }
    plan: { nombre: string }
  }
  // Anulación: el pago no se borra, queda marcado. "anuladoPor" es
  // opcional porque no todos los endpoints incluyen el nombre
  anulado: boolean
  anuladoEn: string | null
  motivoAnulacion: string | null
  anuladoPor?: { nombre: string } | null
}

// Forma de la respuesta de GET /pagos
export interface PagosConResumen {
  pagos: PagoRegistro[]
  resumen: Resumen
}

// Un gasto tal como lo devuelve el backend. Es el espejo de
// PagoRegistro, con categoría y descripción en lugar de cliente y plan
export interface GastoRegistro {
  id: number
  descripcion: string
  monto: string
  fecha: string
  metodoPago: string
  cierreCajaId: number | null
  categoria: { nombre: string }
  registradoPor: { nombre: string }
}

// El resumen de la previsualización de un cierre. Extiende el
// Resumen de ingresos con los campos que el backend agrega al cruzar gastos
export interface ResumenCierre extends Resumen {
  totalGastos: string
  totalGastosEfectivo: string
  // ingresos en efectivo menos gastos en efectivo: lo que debería haber en caja
  efectivoEsperado: string
}

// La respuesta completa de GET /cierres/previsualizar
export interface PrevisualizacionCierre {
  pagos: PagoRegistro[]
  gastos: GastoRegistro[]
  resumen: ResumenCierre
}