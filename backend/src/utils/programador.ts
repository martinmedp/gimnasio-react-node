import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import type { ConfiguracionRespaldo } from '@prisma/client';
import prisma from '../prisma';
import { ejecutarRespaldo, RespaldoEnCursoError } from './respaldo';

// La tarea programada actual (null si no hay ninguna)
let tarea: ScheduledTask | null = null;

// Lee la configuración de los respaldos automáticos. Es una sola fila
// (id = 1): si todavía no existe, se crea con los valores por defecto
// (desactivado, a las 20:00)
export async function leerConfiguracion(): Promise<ConfiguracionRespaldo> {
  return prisma.configuracionRespaldo.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

// Programa (o reprograma) el respaldo diario según la configuración.
// Primero se detiene la tarea anterior, si la había, para no acumular relojes
export function reprogramar(configuracion: ConfiguracionRespaldo): void {
  if (tarea) {
    tarea.stop();
    tarea = null;
  }
  if (!configuracion.activo) return;

  const [hora, minuto] = configuracion.hora.split(':').map(Number);

  // Expresión cron: "minuto hora * * *" = todos los días a esa hora, en la
  // hora local del servidor
  tarea = cron.schedule(`${minuto} ${hora} * * *`, () => {
    ejecutarRespaldo('programado', null).catch((error) => {
      // Solo puede lanzar si ya había uno en curso, y entonces no hace falta otro
      if (!(error instanceof RespaldoEnCursoError)) {
        console.error('[respaldos] Error inesperado en el respaldo programado:', error);
      }
    });
  });

  console.log(`[respaldos] Respaldo diario programado a las ${configuracion.hora}`);
}

// Si el respaldo programado ya debía haberse hecho hoy y no hay ninguno
// bueno, lo hace al arrancar. Cubre el caso del equipo apagado a la hora
// del respaldo
async function recuperarSiFalta(configuracion: ConfiguracionRespaldo): Promise<void> {
  if (!configuracion.activo) return;

  const ahora = new Date();
  const [hora, minuto] = configuracion.hora.split(':').map(Number);
  const programadoHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hora, minuto);

  // Todavía no llega la hora de hoy: lo hará el reloj normalmente
  if (ahora < programadoHoy) return;

  const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const hecho = await prisma.respaldo.findFirst({
    where: { estado: 'ok', creadoEn: { gte: inicioDeHoy } },
  });
  if (hecho) return;

  console.log('[respaldos] No hay respaldo de hoy: se hace ahora');
  await ejecutarRespaldo('programado', null);
}

// Se llama una vez cuando arranca el backend
export async function iniciarProgramador(): Promise<void> {
  const configuracion = await leerConfiguracion();
  reprogramar(configuracion);
  await recuperarSiFalta(configuracion);
}