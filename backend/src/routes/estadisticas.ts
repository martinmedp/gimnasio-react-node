import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';
import { resumirPagos } from '../utils/contabilidad';

const router = Router();

// Abreviaturas de mes escritas a mano, para no depender de cómo cada
// sistema (Windows, navegador) abrevie los meses con toLocaleDateString
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Cuántos meses muestra la gráfica de finanzas, contando el mes actual
const CANTIDAD_MESES = 6;

// Cuántos días abarcan las gráficas de asistencia, contando hoy
const DIAS_ASISTENCIA = 30;

// Nombres de la semana empezando por lunes (igual que el resto de la app)
const NOMBRES_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Clave "AAAA-MM" de una fecha. Usa getFullYear/getMonth (hora LOCAL del
// servidor, Colombia), igual que el resto de cálculos de fechas del
// proyecto: un pago hecho el 31 a las 9 p. m. cuenta para ese mes y no
// para el siguiente, como pasaría si midiéramos en UTC
function claveMes(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}`;
}

// Clave "AAAA-MM-DD" de una fecha, también en hora local
function claveDia(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${claveMes(fecha)}-${dia}`;
}

interface AcumuladoMes {
  mes: string;
  etiqueta: string;
  ingresos: Prisma.Decimal;
  gastos: Prisma.Decimal;
}

// GET /estadisticas/finanzas — ingresos y gastos de los últimos 6 meses y
// el desglose por método de pago del mes actual. Solo Administrador.
//
// Cuenta TODOS los pagos y gastos, estén o no incluidos en un cierre de
// caja: el cierre es un control de caja, no cambia cuánto entró ni salió
router.get('/finanzas', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const ahora = new Date();

    // Primer día del mes más antiguo del rango (hace 5 meses). Con meses
    // negativos, new Date cruza el año solo (enero - 2 = noviembre anterior)
    const inicioRango = new Date(ahora.getFullYear(), ahora.getMonth() - (CANTIDAD_MESES - 1), 1, 0, 0, 0, 0);

    // select trae solo las columnas necesarias. Dos consultas en paralelo
    const [pagos, gastos] = await Promise.all([
      prisma.pago.findMany({
        where: { fecha: { gte: inicioRango } },
        select: { fecha: true, monto: true, metodoPago: true },
      }),
      prisma.gasto.findMany({
        where: { fecha: { gte: inicioRango } },
        select: { fecha: true, monto: true },
      }),
    ]);

    // Preparamos los 6 meses en cero ANTES de sumar, para que un mes sin
    // movimientos aparezca igual en la gráfica (en 0) y no desaparezca.
    // Un Map conserva el orden de inserción: del más antiguo al más reciente
    const acumulado = new Map<string, AcumuladoMes>();
    for (let i = CANTIDAD_MESES - 1; i >= 0; i--) {
      const primerDia = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      acumulado.set(claveMes(primerDia), {
        mes: claveMes(primerDia),
        etiqueta: `${MESES_CORTOS[primerDia.getMonth()]} ${primerDia.getFullYear()}`,
        ingresos: new Prisma.Decimal(0),
        gastos: new Prisma.Decimal(0),
      });
    }

    // Sumamos con Decimal (aritmética exacta) y solo al final pasamos a número
    for (const pago of pagos) {
      const mes = acumulado.get(claveMes(pago.fecha));
      if (mes) mes.ingresos = mes.ingresos.plus(pago.monto);
    }
    for (const gasto of gastos) {
      const mes = acumulado.get(claveMes(gasto.fecha));
      if (mes) mes.gastos = mes.gastos.plus(gasto.monto);
    }

    // Aquí los montos salen como NÚMEROS y no como texto: la librería de
    // gráficas los necesita así
    const meses = Array.from(acumulado.values()).map((m) => ({
      mes: m.mes,
      etiqueta: m.etiqueta,
      ingresos: m.ingresos.toNumber(),
      gastos: m.gastos.toNumber(),
      neto: m.ingresos.minus(m.gastos).toNumber(),
    }));

    const actual = meses[meses.length - 1];
    const pagosDelMes = pagos.filter((p) => claveMes(p.fecha) === claveMes(ahora));
    const resumenMes = resumirPagos(pagosDelMes);

    res.json({
      meses,
      mesActual: {
        etiqueta: actual.etiqueta,
        ingresos: actual.ingresos,
        gastos: actual.gastos,
        neto: actual.neto,
        porMetodo: resumenMes.porMetodo.map((m) => ({
          metodoPago: m.metodoPago,
          total: m.total.toNumber(),
          cantidad: m.cantidad,
        })),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular las estadísticas financieras' });
  }
});

// GET /estadisticas/asistencia — entradas de los últimos 30 días, vistas
// de tres formas: por día, por día de la semana y por hora. Solo Administrador.
// Las tres series salen de las MISMAS filas, así que sus totales coinciden
router.get('/asistencia', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const ahora = new Date();

    // Medianoche de hace 29 días: junto con hoy suman 30 días completos
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - (DIAS_ASISTENCIA - 1), 0, 0, 0, 0);

    const asistencias = await prisma.asistencia.findMany({
      where: { fecha: { gte: inicio } },
      select: { fecha: true },
    });

    // Serie 1: entradas por día. Se preparan los 30 días en cero para que
    // un día sin entradas se vea como un punto en 0 y no como un hueco
    const porDiaMapa = new Map<string, { fecha: string; etiqueta: string; entradas: number }>();
    for (let i = DIAS_ASISTENCIA - 1; i >= 0; i--) {
      const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - i);
      porDiaMapa.set(claveDia(dia), {
        fecha: claveDia(dia),
        etiqueta: `${dia.getDate()} ${MESES_CORTOS[dia.getMonth()]}`,
        entradas: 0,
      });
    }

    // Serie 2: por día de la semana (7 posiciones, lunes primero)
    const porDiaSemana = NOMBRES_DIA.map((dia) => ({ dia, entradas: 0 }));

    // Serie 3: por hora del día (24 posiciones, luego se recorta)
    const entradasPorHora = new Array<number>(24).fill(0);

    for (const asistencia of asistencias) {
      const fecha = asistencia.fecha;

      const registroDia = porDiaMapa.get(claveDia(fecha));
      if (registroDia) registroDia.entradas += 1;

      // getDay(): 0 = domingo ... 6 = sábado. Lo pasamos a 0 = lunes ... 6 = domingo
      const indiceSemana = fecha.getDay() === 0 ? 6 : fecha.getDay() - 1;
      porDiaSemana[indiceSemana].entradas += 1;

      entradasPorHora[fecha.getHours()] += 1;
    }

    // Mostrar las 24 horas dejaría la gráfica llena de ceros de madrugada.
    // Recortamos al rango entre la primera y la última hora con entradas;
    // si todavía no hay datos, un rango razonable por defecto (6 a 21)
    let horaMin = 6;
    let horaMax = 21;
    const horasConEntradas = entradasPorHora.map((n, hora) => (n > 0 ? hora : -1)).filter((hora) => hora >= 0);
    if (horasConEntradas.length > 0) {
      horaMin = Math.min(...horasConEntradas);
      horaMax = Math.max(...horasConEntradas);
    }

    // Etiquetas en formato de 24 horas ("18:00"), para evitar la confusión
    // de a. m. / p. m.
    const porHora: { hora: number; etiqueta: string; entradas: number }[] = [];
    for (let hora = horaMin; hora <= horaMax; hora++) {
      porHora.push({ hora, etiqueta: `${hora}:00`, entradas: entradasPorHora[hora] });
    }

    res.json({
      dias: DIAS_ASISTENCIA,
      porDia: Array.from(porDiaMapa.values()),
      porDiaSemana,
      porHora,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular las estadísticas de asistencia' });
  }
});

export default router;