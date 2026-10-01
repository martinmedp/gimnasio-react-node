// Utilidades de formato compartidas por las pantallas de contabilidad
// (Pagos y Cierres). Se pueden reutilizar en cualquier otra pantalla.

// Convierte un valor de dinero en texto legible: 80000 -> "$80.000".
// El backend envía los montos como string (así serializa Prisma los
// Decimal), por eso aceptamos string o number.
// Los negativos se muestran como -$5.000 (signo antes del símbolo)
export function formatearDinero(valor: string | number): string {
  const numero = Number(valor)
  const texto = Math.abs(numero).toLocaleString('es-CO')
  return numero < 0 ? `-$${texto}` : `$${texto}`
}

// Las fechas llegan del backend como texto ISO en UTC, por ejemplo
// "2026-09-29T01:00:00.000Z". new Date(...) las convierte a la hora LOCAL
// del navegador, así un pago hecho a las 8 p. m. se muestra en el día
// correcto. Por eso NO usamos .substring(0, 10) con estas fechas: eso
// mostraría la fecha en UTC, que después de las 7 p. m. (hora de Colombia)
// ya es el día siguiente
export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Convierte "2026-09-28" (el formato de un <input type="date">) en
// "28/09/2026", sin pasar por Date para evitar cualquier desfase de zona
export function formatearFechaInput(valor: string): string {
  return valor.split('-').reverse().join('/')
}

// Convierte un Date en "AAAA-MM-DD" usando la hora LOCAL (lo que espera
// un <input type="date">). No usamos toISOString() porque devuelve UTC
export function fechaParaInput(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

// Rangos rápidos para los botones "Hoy", "Esta semana" y "Este mes"
export function rangoPreset(tipo: 'hoy' | 'semana' | 'mes'): { desde: string; hasta: string } {
  const hoy = new Date()

  if (tipo === 'hoy') {
    return { desde: fechaParaInput(hoy), hasta: fechaParaInput(hoy) }
  }

  if (tipo === 'semana') {
    // getDay() da 0 = domingo ... 6 = sábado. Queremos que la semana
    // empiece el lunes, así que calculamos cuántos días han pasado desde él
    const diaSemana = hoy.getDay()
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasDesdeLunes)
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
    return { desde: fechaParaInput(lunes), hasta: fechaParaInput(domingo) }
  }

  // Mes actual: del día 1 al último día. new Date(año, mes + 1, 0) es el
  // truco estándar para obtener el último día del mes
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { desde: fechaParaInput(primero), hasta: fechaParaInput(ultimo) }
}

// Color y etiqueta para una diferencia de caja (contado - esperado)
export function estiloDiferencia(valor: number): { clase: string; etiqueta: string } {
  if (valor === 0) return { clase: 'text-green-400', etiqueta: 'Caja cuadrada' }
  if (valor < 0) return { clase: 'text-red-400', etiqueta: 'Faltante' }
  return { clase: 'text-yellow-400', etiqueta: 'Sobrante' }
}