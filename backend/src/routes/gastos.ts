import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';
import { rangoDeFechas } from '../utils/fechas';

const router = Router();

const ROLES_GASTOS = ['Administrador', 'Recepcionista'];

// GET /gastos — lista de gastos con filtros opcionales por query string:
//   ?desde=2026-10-01&hasta=2026-10-31  (deben venir las dos juntas)
//   &categoriaId=2
//   &metodoPago=efectivo
//   &estadoCierre=pendiente | cerrado
// Mismo patrón exacto que GET /pagos
router.get('/', verificarToken, verificarRol(...ROLES_GASTOS), async (req, res) => {
  try {
    const { desde, hasta, categoriaId, metodoPago, estadoCierre } = req.query;

    const where: Prisma.GastoWhereInput = {};

    if (desde || hasta) {
      const rango = rangoDeFechas(desde, hasta);
      if (!rango) {
        return res.status(400).json({
          error: 'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"',
        });
      }
      where.fecha = { gte: rango.inicio, lte: rango.fin };
    }

    if (typeof categoriaId === 'string' && categoriaId) {
      where.categoriaId = Number(categoriaId);
    }

    if (typeof metodoPago === 'string' && metodoPago) {
      where.metodoPago = metodoPago;
    }

    if (estadoCierre === 'pendiente') where.cierreCajaId = null;
    if (estadoCierre === 'cerrado') where.cierreCajaId = { not: null };

    const gastos = await prisma.gasto.findMany({
      where,
      include: {
        categoria: { select: { nombre: true } },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    // Igual que en pagos, devolvemos también un resumen con el total de
    // la selección actual — así el frontend no tiene que sumar manualmente
    const totalGeneral = gastos.reduce((suma, g) => suma.plus(g.monto), new Prisma.Decimal(0));

    res.json({ gastos, resumen: { totalGeneral, cantidad: gastos.length } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los gastos' });
  }
});

// POST /gastos — registra un nuevo gasto
router.post('/', verificarToken, verificarRol(...ROLES_GASTOS), async (req: any, res) => {
  try {
    const { categoriaId, descripcion, monto, metodoPago } = req.body;

    if (!categoriaId || !descripcion || !monto || !metodoPago) {
      return res.status(400).json({ error: 'Categoría, descripción, monto y método de pago son obligatorios' });
    }

    const nuevoGasto = await prisma.gasto.create({
      data: {
        categoriaId: Number(categoriaId),
        descripcion,
        monto,
        metodoPago,
        // Igual que en Pago, el responsable sale del token, nunca del
        // frontend: evita que alguien pueda "registrar a nombre de otro"
        registradoPorId: req.usuario.id,
      },
      include: { categoria: { select: { nombre: true } }, registradoPor: { select: { nombre: true } } },
    });

    res.status(201).json(nuevoGasto);
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'La categoría indicada no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el gasto' });
  }
});

// DELETE /gastos/:id — elimina un gasto, SOLO si todavía está pendiente
// de cierre. Un gasto ya incluido en un cierre no se puede borrar (igual
// que un Pago no se puede borrar una vez cerrado) — la única forma de
// "deshacerlo" en ese caso es revirtiendo el cierre completo
router.delete('/:id', verificarToken, verificarRol(...ROLES_GASTOS), async (req, res) => {
  try {
    const { id } = req.params;

    const gasto = await prisma.gasto.findUnique({ where: { id: Number(id) } });

    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    if (gasto.cierreCajaId) {
      return res.status(409).json({ error: 'No se puede eliminar: este gasto ya forma parte de un cierre de caja' });
    }

    await prisma.gasto.delete({ where: { id: Number(id) } });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el gasto' });
  }
});

export default router;