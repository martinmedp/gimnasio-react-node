import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';
import { rangoDeFechas } from '../utils/fechas';
import { resumirPagos } from '../utils/contabilidad';
import { crearPdf, dibujarEncabezado, dibujarTabla, formatearDineroPdf, formatearFechaPdf, formatearFechaHoraPdf } from '../utils/pdf';

const router = Router();

router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { desde, hasta, metodoPago, estadoCierre } = req.query;

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

// GET /pagos/reporte/pdf — mismo filtro que GET /pagos (desde, hasta,
// metodoPago, estadoCierre), pero devuelve un PDF en vez de JSON. Va
// ANTES de cualquier ruta "/:id" para que Express no confunda "reporte"
// con un id — aunque hoy este router no tiene ninguna ruta "/:id" directa,
// dejamos este orden por si se agrega una en el futuro
router.get('/reporte/pdf', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { desde, hasta, metodoPago, estadoCierre } = req.query;

    const where: Prisma.PagoWhereInput = {};
    let descripcionPeriodo = 'Todo el historial';

    if (desde || hasta) {
      const rango = rangoDeFechas(desde, hasta);
      if (!rango) {
        return res.status(400).json({
          error: 'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"',
        });
      }
      where.fecha = { gte: rango.inicio, lte: rango.fin };
      descripcionPeriodo = `Del ${formatearFechaPdf(rango.inicio)} al ${formatearFechaPdf(rango.fin)}`;
    }

    if (typeof metodoPago === 'string' && metodoPago) {
      where.metodoPago = metodoPago;
      descripcionPeriodo += ` — Método: ${metodoPago}`;
    }

    if (estadoCierre === 'pendiente') {
      where.cierreCajaId = null;
      descripcionPeriodo += ' — Solo pendientes de cierre';
    }
    if (estadoCierre === 'cerrado') {
      where.cierreCajaId = { not: null };
      descripcionPeriodo += ' — Solo ya cerrados';
    }

    const pagos = await prisma.pago.findMany({
      where,
      include: {
        membresia: {
          include: {
            cliente: { select: { nombre: true, documento: true } },
            plan: { select: { nombre: true } },
          },
        },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    const resumen = resumirPagos(pagos);

    const doc = crearPdf(res, 'reporte-ingresos.pdf');

    dibujarEncabezado(doc, 'Reporte de ingresos', descripcionPeriodo);

    doc.fontSize(10);
    doc.font('Helvetica-Bold').text('Resumen');
    doc.font('Helvetica');
    doc.text(`Total general: ${formatearDineroPdf(resumen.totalGeneral.toString())}`);
    doc.text(`Total en efectivo: ${formatearDineroPdf(resumen.totalEfectivo.toString())}`);
    doc.text(`Cantidad de pagos: ${resumen.cantidad}`);

    if (resumen.porMetodo.length > 0) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Desglose por método de pago');
      doc.font('Helvetica');
      resumen.porMetodo.forEach((m) => {
        doc.text(`${m.metodoPago}: ${formatearDineroPdf(m.total.toString())} (${m.cantidad} pago(s))`);
      });
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Detalle de pagos (${pagos.length})`);
    doc.moveDown(0.3);

    dibujarTabla(
      doc,
      [
        { titulo: 'Fecha', ancho: 65 },
        { titulo: 'Cliente', ancho: 110 },
        { titulo: 'Plan', ancho: 90 },
        { titulo: 'Método', ancho: 60 },
        { titulo: 'Monto', ancho: 70, alinearDerecha: true },
        { titulo: 'Estado', ancho: 55 },
      ],
      pagos.map((pago) => [
        formatearFechaPdf(pago.fecha),
        pago.membresia.cliente.nombre,
        pago.membresia.plan.nombre,
        pago.metodoPago,
        formatearDineroPdf(pago.monto.toString()),
        pago.cierreCajaId ? `Cierre #${pago.cierreCajaId}` : 'Pendiente',
      ])
    );

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte de ingresos' });
  }
});

// GET /pagos/:id/recibo — comprobante de un pago individual, pensado
// para entregarle al cliente en el momento (impreso o como PDF digital)
router.get('/:id/recibo', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const pago = await prisma.pago.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        membresia: {
          include: {
            cliente: { select: { nombre: true, documento: true } },
            plan: { select: { nombre: true, tipo: true } },
          },
        },
        registradoPor: { select: { nombre: true } },
      },
    });

    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const doc = crearPdf(res, `recibo-${pago.id}.pdf`);

    dibujarEncabezado(doc, `Recibo de pago #${pago.id}`, formatearFechaHoraPdf(pago.fecha));

    doc.moveDown();
    doc.fontSize(11);
    doc.font('Helvetica-Bold').text('Cliente: ', { continued: true }).font('Helvetica').text(pago.membresia.cliente.nombre);
    doc.font('Helvetica-Bold').text('Documento: ', { continued: true }).font('Helvetica').text(pago.membresia.cliente.documento);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Plan: ', { continued: true }).font('Helvetica').text(`${pago.membresia.plan.nombre} (${pago.membresia.plan.tipo})`);
    doc.font('Helvetica-Bold').text('Método de pago: ', { continued: true }).font('Helvetica').text(pago.metodoPago);
    doc.font('Helvetica-Bold').text('Atendido por: ', { continued: true }).font('Helvetica').text(pago.registradoPor.nombre);

    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text(`Total pagado: ${formatearDineroPdf(pago.monto.toString())}`);

    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica').fillColor('#555555').text('Gracias por su pago.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el recibo' });
  }
});

export default router;