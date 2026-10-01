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
}

// Forma de la respuesta de GET /pagos y GET /cierres/previsualizar
export interface PagosConResumen {
  pagos: PagoRegistro[]
  resumen: Resumen
}