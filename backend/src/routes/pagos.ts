import { Router } from 'express';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { verificarToken, verificarRol, RequestConUsuario } from '../middleware/auth';
import { rangoDeFechas } from '../utils/fechas';
import { resumirPagos } from '../utils/contabilidad';
import { crearPdf, dibujarEncabezado, dibujarTabla, formatearDineroPdf, formatearFechaPdf, formatearFechaHoraPdf } from '../utils/pdf';

const router = Router();

const MENSAJE_RANGO_INVALIDO =
  'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"';

// Datos que acompañan a cada pago en los listados. "satisfies" comprueba
// que el objeto es un include válido de Prisma sin perder su tipo exacto,
// para que TypeScript sepa qué campos trae cada pago
const INCLUDE_PAGO = {
  membresia: {
    include: {
      cliente: { select: { id: true, nombre: true, documento: true } },
      plan: { select: { nombre: true } },
    },
  },
  registradoPor: { select: { nombre: true } },
  anuladoPor: { select: { nombre: true } },
} satisfies Prisma.PagoInclude;

// Arma el filtro que comparten el listado y el reporte en PDF, a partir de
// los parámetros de la URL:
//   desde + hasta (juntas), metodoPago, estadoCierre (pendiente | cerrado),
//   estadoPago (valido | anulado)
// Devuelve el filtro de Prisma y una descripción legible para el PDF,
// o un error si el rango de fechas no es válido
function construirFiltro(query: any): { where: Prisma.PagoWhereInput; descripcion: string } | { error: string } {
  const { desde, hasta, metodoPago, estadoCierre, estadoPago } = query;

  const where: Prisma.PagoWhereInput = {};
  let descripcion = 'Todo el historial';

  if (desde || hasta) {
    const rango = rangoDeFechas(desde, hasta);
    if (!rango) return { error: MENSAJE_RANGO_INVALIDO };
    where.fecha = { gte: rango.inicio, lte: rango.fin };
    descripcion = `Del ${formatearFechaPdf(rango.inicio)} al ${formatearFechaPdf(rango.fin)}`;
  }

  if (typeof metodoPago === 'string' && metodoPago) {
    where.metodoPago = metodoPago;
    descripcion += ` — Método: ${metodoPago}`;
  }

  // Un pago anulado nunca está "pendiente de cierre": no va a entrar a
  // ningún cierre. Por eso "pendiente" exige además que sea válido
  if (estadoCierre === 'pendiente') {
    where.cierreCajaId = null;
    where.anulado = false;
    descripcion += ' — Solo pendientes de cierre';
  }
  if (estadoCierre === 'cerrado') {
    where.cierreCajaId = { not: null };
    descripcion += ' — Solo ya cerrados';
  }

  if (estadoPago === 'valido') {
    where.anulado = false;
    descripcion += ' — Solo pagos válidos';
  }
  if (estadoPago === 'anulado') {
    where.anulado = true;
    descripcion += ' — Solo pagos anulados';
  }

  return { where, descripcion };
}

// GET /pagos — registro de ingresos con filtros opcionales.
// Los pagos anulados SÍ aparecen en la lista (con sus datos de anulación,
// para dejar rastro), pero el resumen de totales los ignora.
// Solo Administrador y Recepcionista
router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const filtro = construirFiltro(req.query);
    if ('error' in filtro) {
      return res.status(400).json({ error: filtro.error });
    }

    const pagos = await prisma.pago.findMany({
      where: filtro.where,
      include: INCLUDE_PAGO,
      orderBy: { fecha: 'desc' },
    });

    // Los totales cuentan SOLO los pagos válidos
    res.json({ pagos, resumen: resumirPagos(pagos.filter((pago) => !pago.anulado)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los pagos' });
  }
});

// GET /pagos/reporte/pdf — mismo filtro que el listado, en PDF.
// Los pagos anulados aparecen marcados en la tabla, pero no suman en los totales
router.get('/reporte/pdf', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const filtro = construirFiltro(req.query);
    if ('error' in filtro) {
      return res.status(400).json({ error: filtro.error });
    }

    const pagos = await prisma.pago.findMany({
      where: filtro.where,
      include: INCLUDE_PAGO,
      orderBy: { fecha: 'desc' },
    });

    const pagosValidos = pagos.filter((pago) => !pago.anulado);
    const hayAnulados = pagos.length !== pagosValidos.length;
    const resumen = resumirPagos(pagosValidos);

    const doc = crearPdf(res, 'reporte-ingresos.pdf');

    dibujarEncabezado(doc, 'Reporte de ingresos', filtro.descripcion);

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

    if (hayAnulados) {
      doc.moveDown(0.3);
      doc.fillColor('#cc0000').text('Los pagos anulados aparecen en el detalle, pero no se suman en los totales.');
      doc.fillColor('#000000');
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
        pago.anulado ? 'ANULADO' : pago.cierreCajaId ? `Cierre #${pago.cierreCajaId}` : 'Pendiente',
      ])
    );

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte de ingresos' });
  }
});

// POST /pagos/:id/anular — anula un pago. Solo Administrador.
// Body: { password, motivo }
//
// El pago NO se borra: queda marcado como anulado, con quién, cuándo y por
// qué. Exige la CONTRASEÑA del Administrador (igual que revertir un cierre)
// y un motivo. Un pago que ya forma parte de un cierre de caja no se puede
// anular directamente: primero hay que revertir ese cierre
router.post('/:id/anular', verificarToken, verificarRol('Administrador'), async (req: RequestConUsuario, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { password, motivo } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Debes confirmar tu contraseña para anular un pago' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Debes indicar el motivo de la anulación' });
    }

    // Releemos al usuario con su hash: el token nunca trae la contraseña
    const administrador = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!administrador) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const passwordValida = await bcrypt.compare(password, administrador.password);
    if (!passwordValida) {
      return res.status(403).json({ error: 'Contraseña incorrecta' });
    }

    const pagoId = Number(req.params.id);

    const resultado = await prisma.$transaction(async (tx) => {
      const pago = await tx.pago.findUnique({ where: { id: pagoId } });

      if (!pago) return { tipo: 'no_encontrado' as const };
      if (pago.anulado) return { tipo: 'ya_anulado' as const };
      if (pago.cierreCajaId) return { tipo: 'en_cierre' as const, cierreId: pago.cierreCajaId };

      // El filtro repite las condiciones (sigue válido y sin cierre): si
      // otra persona lo cerró o anuló justo en este instante, no encuentra
      // fila que actualizar y lo tratamos como conflicto en vez de pisarlo
      const actualizados = await tx.pago.updateMany({
        where: { id: pagoId, anulado: false, cierreCajaId: null },
        data: {
          anulado: true,
          anuladoEn: new Date(),
          anuladoPorId: administrador.id,
          motivoAnulacion: motivo.trim(),
        },
      });
      if (actualizados.count === 0) return { tipo: 'conflicto' as const };

      const pagoAnulado = await tx.pago.findUnique({ where: { id: pagoId }, include: INCLUDE_PAGO });
      return { tipo: 'ok' as const, pago: pagoAnulado };
    });

    if (resultado.tipo === 'no_encontrado') {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    if (resultado.tipo === 'ya_anulado') {
      return res.status(409).json({ error: 'Este pago ya fue anulado anteriormente' });
    }
    if (resultado.tipo === 'en_cierre') {
      return res.status(409).json({
        error: `Este pago ya forma parte del cierre #${resultado.cierreId}. Revierte ese cierre primero para poder anularlo`,
      });
    }
    if (resultado.tipo === 'conflicto') {
      return res.status(409).json({ error: 'El pago cambió mientras se anulaba. Vuelve a intentarlo' });
    }

    res.json(resultado.pago);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al anular el pago' });
  }
});

// GET /pagos/:id/recibo — comprobante de un pago individual. Si el pago
// está anulado, el recibo lo dice bien visible: nadie debería poder
// presentar un recibo anulado como si fuera válido
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
        anuladoPor: { select: { nombre: true } },
      },
    });

    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const doc = crearPdf(res, `recibo-${pago.id}.pdf`);

    dibujarEncabezado(doc, `Recibo de pago #${pago.id}`, formatearFechaHoraPdf(pago.fecha));

    if (pago.anulado) {
      doc.moveDown(0.5);
      doc.fillColor('#cc0000').font('Helvetica-Bold').fontSize(14).text('PAGO ANULADO');
      doc.font('Helvetica').fontSize(10);
      if (pago.anuladoPor && pago.anuladoEn) {
        doc.text(`Anulado por ${pago.anuladoPor.nombre} el ${formatearFechaHoraPdf(pago.anuladoEn)}`);
      }
      if (pago.motivoAnulacion) {
        doc.text(`Motivo: ${pago.motivoAnulacion}`);
      }
      doc.fillColor('#000000');
    }

    doc.moveDown();
    doc.fontSize(11);
    doc.font('Helvetica-Bold').text('Cliente: ', { continued: true }).font('Helvetica').text(pago.membresia.cliente.nombre);
    doc.font('Helvetica-Bold').text('Documento: ', { continued: true }).font('Helvetica').text(pago.membresia.cliente.documento);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Plan: ', { continued: true }).font('Helvetica').text(`${pago.membresia.plan.nombre} (${pago.membresia.plan.tipo})`);
    doc.font('Helvetica-Bold').text('Método de pago: ', { continued: true }).font('Helvetica').text(pago.metodoPago);
    doc.font('Helvetica-Bold').text('Atendido por: ', { continued: true }).font('Helvetica').text(pago.registradoPor.nombre);

    doc.moveDown();
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`${pago.anulado ? 'Valor anulado' : 'Total pagado'}: ${formatearDineroPdf(pago.monto.toString())}`);

    if (!pago.anulado) {
      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica').fillColor('#555555').text('Gracias por su pago.', { align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el recibo' });
  }
});

export default router;