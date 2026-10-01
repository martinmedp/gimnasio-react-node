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