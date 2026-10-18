// Utilidades para rangos de fechas que llegan como texto desde el frontend
// (formato AAAA-MM-DD, el mismo que produce un <input type="date">)

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Convierte dos textos "AAAA-MM-DD" en un rango de Date listo para las
// consultas de Prisma. Devuelve null si alguna fecha es inválida o si
// "desde" es posterior a "hasta".
//
// Detalle importante: la hora se agrega SIN la letra "Z" (`T00:00:00`).
// Sin la "Z", JavaScript interpreta la fecha en la hora LOCAL del servidor
// (Colombia), no en UTC. Así "2026-09-28" significa el día 28 completo tal
// como lo ve el personal, y un pago hecho a las 8 p. m. cae en el día
// correcto en vez de correrse al día siguiente.
export function rangoDeFechas(desde: unknown, hasta: unknown): { inicio: Date; fin: Date } | null {
  // req.query puede traer strings, arreglos o undefined: solo aceptamos strings
  if (typeof desde !== 'string' || typeof hasta !== 'string') return null;
  if (!FORMATO_FECHA.test(desde) || !FORMATO_FECHA.test(hasta)) return null;

  const inicio = new Date(`${desde}T00:00:00`);
  // El fin es el último milisegundo del día "hasta", así el rango
  // incluye ese día completo
  const fin = new Date(`${hasta}T23:59:59.999`);

  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return null;
  if (inicio > fin) return null;

  return { inicio, fin };
}

export type PeriodoPredefinido = 'hoy' | 'semana' | 'mes';

// Devuelve el rango de un periodo "relativo a hoy", calculado por el
// servidor. Es la versión del backend de rangoPreset (que ya existe en el
// frontend): así el contador no depende de lo que el navegador crea que es
// "hoy", y el servidor es siempre la fuente de verdad.
//
// Igual que arriba, usamos new Date(año, mes, día...) que construye la
// fecha en hora LOCAL del servidor, no en UTC
export function rangoPredefinido(periodo: PeriodoPredefinido): { inicio: Date; fin: Date } {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth();
  const dia = ahora.getDate();

  if (periodo === 'hoy') {
    return {
      inicio: new Date(anio, mes, dia, 0, 0, 0, 0),
      fin: new Date(anio, mes, dia, 23, 59, 59, 999),
    };
  }

  if (periodo === 'semana') {
    // getDay() da 0 = domingo ... 6 = sábado. La semana empieza el lunes,
    // así que calculamos cuántos días pasaron desde el lunes de esta semana
    const diaSemana = ahora.getDay();
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    // new Date acepta días fuera de rango (negativos o mayores al mes) y
    // los ajusta solo, cruzando de mes sin que tengamos que calcularlo
    return {
      inicio: new Date(anio, mes, dia - diasDesdeLunes, 0, 0, 0, 0),
      fin: new Date(anio, mes, dia - diasDesdeLunes + 6, 23, 59, 59, 999),
    };
  }

  // Mes actual: del día 1 al último día. new Date(año, mes + 1, 0) es el
  // truco estándar para obtener el último día del mes
  return {
    inicio: new Date(anio, mes, 1, 0, 0, 0, 0),
    fin: new Date(anio, mes + 1, 0, 23, 59, 59, 999),
  };
}