import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol, verificarPropioCliente, RequestConUsuario } from '../middleware/auth';
import { rangoDeFechas, rangoPredefinido } from '../utils/fechas';

const router = Router();

const MENSAJE_RANGO_INVALIDO =
  'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"';

// Motivos por los que una entrada necesita confirmación del personal.
// El código se guarda tal cual en Asistencia.motivoForzada si se fuerza
type CodigoAdvertencia = 'SIN_MEMBRESIA' | 'VENCIDA' | 'SIN_ENTRADAS' | 'YA_REGISTRO_HOY';

interface Advertencia {
  codigo: CodigoAdvertencia;
  mensaje: string;
}

// GET /asistencias/hoy — asistencias del día actual, para el "log" rápido
// del mostrador. Incluye quién autorizó las entradas forzadas
router.get('/hoy', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const hoy = rangoPredefinido('hoy');

    const asistencias = await prisma.asistencia.findMany({
      where: { fecha: { gte: hoy.inicio, lte: hoy.fin } },
      include: { cliente: true, autorizadaPor: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    });

    res.json(asistencias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las asistencias de hoy' });
  }
});

// GET /asistencias — historial con filtros opcionales:
//   ?desde=2026-09-01&hasta=2026-09-30  (deben venir las dos juntas)
//   &clienteId=5
// Administrador y Recepcionista
router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { desde, hasta, clienteId } = req.query;

    const where: any = {};

    if (desde || hasta) {
      const rango = rangoDeFechas(desde, hasta);
      if (!rango) {
        return res.status(400).json({ error: MENSAJE_RANGO_INVALIDO });
      }
      where.fecha = { gte: rango.inicio, lte: rango.fin };
    }

    if (typeof clienteId === 'string' && clienteId) {
      where.clienteId = Number(clienteId);
    }

    const asistencias = await prisma.asistencia.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, documento: true, fotoUrl: true } },
        autorizadaPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    res.json(asistencias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial de asistencias' });
  }
});

// GET /asistencias/cliente/:clienteId — historial de UN cliente. El propio
// Cliente solo puede ver el suyo (verificarPropioCliente).
// Con select devolvemos solo id y fecha: el Cliente no necesita saber si
// una entrada fue "forzada" ni quién la autorizó (es información interna)
router.get(
  '/cliente/:clienteId',
  verificarToken,
  verificarRol('Administrador', 'Recepcionista', 'Cliente'),
  verificarPropioCliente((req) => Number(req.params.clienteId)),
  async (req, res) => {
    try {
      const { clienteId } = req.params;
      const { desde, hasta } = req.query;

      const where: any = { clienteId: Number(clienteId) };

      if (desde || hasta) {
        const rango = rangoDeFechas(desde, hasta);
        if (!rango) {
          return res.status(400).json({ error: MENSAJE_RANGO_INVALIDO });
        }
        where.fecha = { gte: rango.inicio, lte: rango.fin };
      }

      const asistencias = await prisma.asistencia.findMany({
        where,
        select: { id: true, fecha: true },
        orderBy: { fecha: 'desc' },
      });

      res.json(asistencias);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener las asistencias del cliente' });
    }
  }
);

// POST /asistencias — registra la entrada de un cliente.
// Body: { clienteId, descontarTiquetera?, confirmar? }
//
// Antes de registrar se revisa la membresía activa más reciente del cliente
// y si ya entró hoy. Si hay alguna advertencia y NO viene confirmar: true,
// no se registra nada y se responde 409 con la lista de advertencias, para
// que el personal decida. Si viene confirmar: true, la entrada se registra
// MARCADA como forzada (con el motivo y quién la autorizó)
router.post('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req: RequestConUsuario, res) => {
  try {
    const { clienteId, descontarTiquetera, confirmar } = req.body;

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId es obligatorio' });
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: Number(clienteId) } });
    if (!cliente) {
      return res.status(404).json({ error: 'El cliente indicado no existe' });
    }

    const ahora = new Date();

    // Una sola membresía decide todo: la activa más reciente. Es la misma
    // que se usa para descontar la tiquetera (antes se buscaba por separado
    // cualquier tiquetera activa, aunque hubiera otra membresía más nueva)
    const membresia = await prisma.membresia.findFirst({
      where: { clienteId: cliente.id, estado: 'activa' },
      orderBy: { fechaInicio: 'desc' },
      include: { plan: true },
    });

    const advertencias: Advertencia[] = [];

    if (!membresia) {
      advertencias.push({ codigo: 'SIN_MEMBRESIA', mensaje: 'El cliente no tiene una membresía activa.' });
    } else {
      if (membresia.fechaFin && membresia.fechaFin < ahora) {
        advertencias.push({
          codigo: 'VENCIDA',
          mensaje: `La membresía venció el ${membresia.fechaFin.toLocaleDateString('es-CO')}.`,
        });
      }
      if (membresia.plan.tipo === 'tiquetera' && (membresia.entradasRestantes ?? 0) <= 0) {
        advertencias.push({ codigo: 'SIN_ENTRADAS', mensaje: 'La tiquetera no tiene entradas disponibles.' });
      }
    }

    // ¿Ya registró una entrada hoy? Traemos la primera del día para
    // decirle al personal a qué hora fue
    const hoy = rangoPredefinido('hoy');
    const entradaPrevia = await prisma.asistencia.findFirst({
      where: { clienteId: cliente.id, fecha: { gte: hoy.inicio, lte: hoy.fin } },
      orderBy: { fecha: 'asc' },
    });
    if (entradaPrevia) {
      const hora = entradaPrevia.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      advertencias.push({ codigo: 'YA_REGISTRO_HOY', mensaje: `Ya registró una entrada hoy a las ${hora}.` });
    }

    // Hay advertencias y el personal todavía no confirmó: no se registra
    // nada. 409 = "conflicto": la petición es válida pero necesita una decisión
    if (advertencias.length > 0 && confirmar !== true) {
      return res.status(409).json({
        error: 'La entrada necesita confirmación',
        requiereConfirmacion: true,
        advertencias,
      });
    }

    const forzada = advertencias.length > 0;
    const esDuplicadoDelDia = advertencias.some((a) => a.codigo === 'YA_REGISTRO_HOY');

    // Se descuenta una entrada solo si: la membresía es tiquetera y le
    // quedan, el personal no desmarcó la opción, y NO es un segundo registro
    // del mismo día (una tiquetera gasta una entrada por día, no por escaneo)
    const debeDescontar =
      membresia?.plan.tipo === 'tiquetera' &&
      (membresia.entradasRestantes ?? 0) > 0 &&
      descontarTiquetera !== false &&
      !esDuplicadoDelDia;

    // Guardamos el id en una constante: dentro de la transacción (una
    // función anidada) TypeScript ya no recuerda que req.usuario existe
    const autorizadaPorId = req.usuario?.id ?? null;

    // Transacción: crear la asistencia y descontar la entrada van juntas o
    // no se aplica ninguna de las dos
    const resultado = await prisma.$transaction(async (tx) => {
      const asistencia = await tx.asistencia.create({
        data: {
          clienteId: cliente.id,
          forzada,
          motivoForzada: forzada ? advertencias.map((a) => a.codigo).join(',') : null,
          autorizadaPorId: forzada ? autorizadaPorId : null,
        },
        include: { cliente: true },
      });

      let entradasRestantes: number | null = null;

      if (debeDescontar && membresia) {
        // El gt: 0 en el filtro evita bajar de cero si dos entradas se
        // registran casi al mismo tiempo: la segunda no encuentra fila
        // que actualizar y abortamos
        const actualizadas = await tx.membresia.updateMany({
          where: { id: membresia.id, entradasRestantes: { gt: 0 } },
          data: { entradasRestantes: { decrement: 1 } },
        });
        if (actualizadas.count === 0) {
          throw new Error('ENTRADAS_AGOTADAS');
        }
        entradasRestantes = (membresia.entradasRestantes ?? 0) - 1;
      }

      return { asistencia, entradasRestantes };
    });

    // Estado de la membresía para mostrar en el mostrador, aunque todo
    // esté bien ("vence en 3 días", "quedan 4 entradas")
    const entradasActuales = resultado.entradasRestantes ?? membresia?.entradasRestantes ?? null;
    const membresiaInfo = membresia
      ? {
        plan: membresia.plan.nombre,
        tipo: membresia.plan.tipo,
        fechaFin: membresia.fechaFin,
        entradasRestantes: membresia.plan.tipo === 'tiquetera' ? entradasActuales : null,
        diasParaVencer: membresia.fechaFin
          ? Math.ceil((membresia.fechaFin.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }
      : null;

    res.status(201).json({
      asistencia: resultado.asistencia,
      descontoTiquetera: !!debeDescontar,
      entradasRestantes: resultado.entradasRestantes,
      forzada,
      membresia: membresiaInfo,
    });
  } catch (error: any) {
    if (error.message === 'ENTRADAS_AGOTADAS') {
      return res.status(409).json({ error: 'Se agotaron las entradas de la tiquetera. Vuelve a intentarlo' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la asistencia' });
  }
});

// Calcula los cuatro contadores de entradas: hoy, esta semana, este mes y
// total. Si llega clienteId, cuenta solo las de ese cliente
async function calcularContador(clienteId?: number) {
  const base = clienteId !== undefined ? { clienteId } : {};

  const hoy = rangoPredefinido('hoy');
  const semana = rangoPredefinido('semana');
  const mes = rangoPredefinido('mes');

  const [totalHoy, totalSemana, totalMes, total] = await Promise.all([
    prisma.asistencia.count({ where: { ...base, fecha: { gte: hoy.inicio, lte: hoy.fin } } }),
    prisma.asistencia.count({ where: { ...base, fecha: { gte: semana.inicio, lte: semana.fin } } }),
    prisma.asistencia.count({ where: { ...base, fecha: { gte: mes.inicio, lte: mes.fin } } }),
    prisma.asistencia.count({ where: base }),
  ]);

  return { hoy: totalHoy, semana: totalSemana, mes: totalMes, total };
}

// GET /asistencias/contador — contadores de TODO el gimnasio, o de un
// cliente si se manda ?clienteId=5. Administrador y Recepcionista
router.get('/contador', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { clienteId } = req.query;

    let id: number | undefined = undefined;
    if (typeof clienteId === 'string' && clienteId) {
      id = Number(clienteId);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'clienteId inválido' });
      }
    }

    res.json(await calcularContador(id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular el contador de entradas' });
  }
});

// GET /asistencias/cliente/:clienteId/contador — contadores de UN cliente.
// El propio Cliente puede consultar el suyo
router.get(
  '/cliente/:clienteId/contador',
  verificarToken,
  verificarRol('Administrador', 'Recepcionista', 'Cliente'),
  verificarPropioCliente((req) => Number(req.params.clienteId)),
  async (req, res) => {
    try {
      res.json(await calcularContador(Number(req.params.clienteId)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al calcular el contador de entradas' });
    }
  }
);

export default router;