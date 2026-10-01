import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';
import { rangoDeFechas } from '../utils/fechas';
import { resumirPagos } from '../utils/contabilidad';

const router = Router();

// GET /pagos — registro de ingresos, con filtros opcionales por query string:
//   ?desde=2026-09-01&hasta=2026-09-30   (deben venir las dos juntas)
//   &metodoPago=efectivo
//   &estadoCierre=pendiente | cerrado
// Devuelve la lista de pagos y un resumen con los totales de ESA misma
// selección. Solo Administrador y Recepcionista.
router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { desde, hasta, metodoPago, estadoCierre } = req.query;

    // Armamos el filtro de forma dinámica: solo agregamos las condiciones
    // que realmente llegaron. Prisma.PagoWhereInput es el tipo que describe
    // un filtro válido sobre la tabla Pago
    const where: Prisma.PagoWhereInput = {};

    if (desde || hasta) {
      const rango = rangoDeFechas(desde, hasta);
      if (!rango) {
        return res.status(400).json({
          error: 'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"',
        });
      }
      where.fecha = { gte: rango.inicio, lte: rango.fin };
    }

    if (typeof metodoPago === 'string' && metodoPago) {
      where.metodoPago = metodoPago;
    }

    // cierreCajaId null = "pendiente de cierre"; con valor = "ya cerrado"
    if (estadoCierre === 'pendiente') where.cierreCajaId = null;
    if (estadoCierre === 'cerrado') where.cierreCajaId = { not: null };

    const pagos = await prisma.pago.findMany({
      where,
      include: {
        membresia: {
          include: {
            cliente: { select: { id: true, nombre: true, documento: true } },
            plan: { select: { nombre: true } },
          },
        },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    res.json({ pagos, resumen: resumirPagos(pagos) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los pagos' });
  }
});

export default router;