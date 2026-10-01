import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol, verificarPropioCliente } from '../middleware/auth';
import { rangoDeFechas } from '../utils/fechas';

const router = Router();

const MENSAJE_RANGO_INVALIDO =
  'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"';

// GET /asistencias/hoy — igual que antes: asistencias del día actual,
// para el "log" rápido en el mostrador
router.get('/hoy', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const asistencias = await prisma.asistencia.findMany({
      where: { fecha: { gte: inicioDia, lte: finDia } },
      include: { cliente: true },
      orderBy: { fecha: 'desc' },
    });

    res.json(asistencias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las asistencias de hoy' });
  }
});

// GET /asistencias — historial con filtros opcionales por query string:
//   ?desde=2026-09-01&hasta=2026-09-30  (deben venir las dos juntas)
//   &clienteId=5
// Pensado para el personal, que puede ver asistencias de cualquier cliente
// o de todos a la vez. Administrador y Recepcionista
router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { desde, hasta, clienteId } = req.query;

    // where empieza vacío y solo se le agregan las condiciones que
    // realmente llegaron, igual que ya hiciste en GET /pagos
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
      include: { cliente: { select: { id: true, nombre: true, documento: true, fotoUrl: true } } },
      orderBy: { fecha: 'desc' },
    });

    res.json(asistencias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial de asistencias' });
  }
});

// GET /asistencias/cliente/:clienteId — historial de UN cliente específico,
// con el mismo filtro opcional de fechas. Administrador y Recepcionista
// pueden verlo de cualquier cliente; un Cliente solo puede ver el suyo
// (verificarPropioCliente lo garantiza, mismo patrón que en medidas/rutinas)
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
        orderBy: { fecha: 'desc' },
      });

      res.json(asistencias);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener las asistencias del cliente' });
    }
  }
);

// POST /asistencias — sin cambios
router.post('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req: any, res) => {
  try {
    const { clienteId, descontarTiquetera } = req.body;

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId es obligatorio' });
    }

    const membresiaTiquetera = await prisma.membresia.findFirst({
      where: {
        clienteId: Number(clienteId),
        estado: 'activa',
        entradasRestantes: { gt: 0 },
        plan: { tipo: 'tiquetera' },
      },
    });

    const debeDescontar = membresiaTiquetera && descontarTiquetera !== false;

    const operaciones: any[] = [
      prisma.asistencia.create({
        data: { clienteId: Number(clienteId) },
        include: { cliente: true },
      }),
    ];

    let entradasRestantesFinal: number | null = null;

    if (debeDescontar && membresiaTiquetera) {
      operaciones.push(
        prisma.membresia.update({
          where: { id: membresiaTiquetera.id },
          data: { entradasRestantes: { decrement: 1 } },
        })
      );
      entradasRestantesFinal = (membresiaTiquetera.entradasRestantes ?? 0) - 1;
    }

    const resultado = await prisma.$transaction(operaciones);

    res.status(201).json({
      asistencia: resultado[0],
      descontoTiquetera: !!debeDescontar,
      entradasRestantes: entradasRestantesFinal,
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'El cliente indicado no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la asistencia' });
  }
});

export default router;