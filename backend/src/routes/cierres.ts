import { Router } from 'express';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { verificarToken, verificarRol, RequestConUsuario } from '../middleware/auth';
import { rangoDeFechas } from '../utils/fechas';
import { resumirPagos } from '../utils/contabilidad';
import { crearPdf, dibujarEncabezado, dibujarTabla, formatearDineroPdf, formatearFechaPdf, formatearFechaHoraPdf } from '../utils/pdf';

const router = Router();

const ROLES_CONTABLES = ['Administrador', 'Recepcionista'];

const MENSAJE_RANGO_INVALIDO =
  'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"';

/* router.get('/previsualizar', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const rango = rangoDeFechas(req.query.desde, req.query.hasta);
    if (!rango) {
      return res.status(400).json({ error: MENSAJE_RANGO_INVALIDO });
    }

    const pagos = await prisma.pago.findMany({
      where: {
        cierreCajaId: null,
        fecha: { gte: rango.inicio, lte: rango.fin },
      },
      include: {
        membresia: {
          include: {
            cliente: { select: { nombre: true, documento: true } },
            plan: { select: { nombre: true } },
          },
        },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    res.json({ pagos, resumen: resumirPagos(pagos) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al previsualizar el cierre' });
  }
}); */

// GET /cierres/previsualizar?desde=...&hasta=...
// Ahora muestra también los gastos pendientes del mismo rango, y calcula
// el efectivo esperado en caja como: efectivo de ingresos - efectivo de gastos
router.get('/previsualizar', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const rango = rangoDeFechas(req.query.desde, req.query.hasta);
    if (!rango) {
      return res.status(400).json({ error: MENSAJE_RANGO_INVALIDO });
    }

    const pagos = await prisma.pago.findMany({
      where: {
        cierreCajaId: null,
        fecha: { gte: rango.inicio, lte: rango.fin },
      },
      include: {
        membresia: {
          include: {
            cliente: { select: { nombre: true, documento: true } },
            plan: { select: { nombre: true } },
          },
        },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    // Mismo filtro de rango y "pendiente de cierre", pero sobre Gasto
    const gastos = await prisma.gasto.findMany({
      where: {
        cierreCajaId: null,
        fecha: { gte: rango.inicio, lte: rango.fin },
      },
      include: {
        categoria: { select: { nombre: true } },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    const resumenIngresos = resumirPagos(pagos);

    // Gastos no tiene su propia función "resumirPagos" (sería confuso el
    // nombre), así que calculamos aquí mismo el total general y el total
    // en efectivo, con la misma lógica
    const totalGastos = gastos.reduce((suma, g) => suma.plus(g.monto), new Prisma.Decimal(0));
    const totalGastosEfectivo = gastos
      .filter((g) => g.metodoPago === 'efectivo')
      .reduce((suma, g) => suma.plus(g.monto), new Prisma.Decimal(0));

    // El efectivo esperado en caja ya NO es solo el efectivo de ingresos:
    // se le resta el efectivo que salió en gastos durante el mismo periodo
    const efectivoEsperado = resumenIngresos.totalEfectivo.minus(totalGastosEfectivo);

    res.json({
      pagos,
      gastos,
      resumen: {
        ...resumenIngresos,
        totalGastos,
        totalGastosEfectivo,
        efectivoEsperado,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al previsualizar el cierre' });
  }
});


/* router.post('/', verificarToken, verificarRol(...ROLES_CONTABLES), async (req: RequestConUsuario, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const cerradoPorId = req.usuario.id;

    const { desde, hasta, efectivoContado, observaciones } = req.body;

    const rango = rangoDeFechas(desde, hasta);
    if (!rango) {
      return res.status(400).json({ error: MENSAJE_RANGO_INVALIDO });
    }

    if (
      efectivoContado === undefined ||
      efectivoContado === null ||
      efectivoContado === '' ||
      isNaN(Number(efectivoContado)) ||
      Number(efectivoContado) < 0
    ) {
      return res.status(400).json({ error: 'El efectivo contado es obligatorio y debe ser un número mayor o igual a 0' });
    }
    const contado = new Prisma.Decimal(String(efectivoContado));

    const resultado = await prisma.$transaction(async (tx) => {
      const pendientes = await tx.pago.findMany({
        where: { cierreCajaId: null, fecha: { gte: rango.inicio, lte: rango.fin } },
        select: { id: true, monto: true, metodoPago: true },
      });

      if (pendientes.length === 0) return null;

      const resumen = resumirPagos(pendientes);

      const nuevoCierre = await tx.cierreCaja.create({
        data: {
          fechaDesde: rango.inicio,
          fechaHasta: rango.fin,
          totalGeneral: resumen.totalGeneral,
          totalEfectivo: resumen.totalEfectivo,
          efectivoContado: contado,
          diferencia: contado.minus(resumen.totalEfectivo),
          observaciones: observaciones || null,
          cerradoPorId,
        },
      });

      const idsPagos = pendientes.map((p) => p.id);
      const actualizados = await tx.pago.updateMany({
        where: { id: { in: idsPagos }, cierreCajaId: null },
        data: { cierreCajaId: nuevoCierre.id },
      });

      if (actualizados.count !== idsPagos.length) {
        throw new Error('CONFLICTO_CIERRE');
      }

      return { cierre: nuevoCierre, cantidadPagos: idsPagos.length };
    });

    if (!resultado) {
      return res.status(400).json({ error: 'No hay pagos pendientes de cierre en ese rango de fechas' });
    }

    res.status(201).json(resultado);
  } catch (error: any) {
    if (error.message === 'CONFLICTO_CIERRE') {
      return res.status(409).json({ error: 'Otro cierre modificó estos pagos al mismo tiempo. Vuelve a previsualizar e intenta de nuevo' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al realizar el cierre' });
  }
}); */

// POST /cierres — realiza el cierre de caja del rango indicado.
// Ahora cierra juntos los pagos Y los gastos pendientes del periodo, y la
// diferencia se calcula contra el efectivo esperado real:
//   efectivo esperado = efectivo de ingresos - efectivo de gastos
router.post('/', verificarToken, verificarRol(...ROLES_CONTABLES), async (req: RequestConUsuario, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const cerradoPorId = req.usuario.id;

    const { desde, hasta, efectivoContado, observaciones } = req.body;

    const rango = rangoDeFechas(desde, hasta);
    if (!rango) {
      return res.status(400).json({ error: MENSAJE_RANGO_INVALIDO });
    }

    if (
      efectivoContado === undefined ||
      efectivoContado === null ||
      efectivoContado === '' ||
      isNaN(Number(efectivoContado)) ||
      Number(efectivoContado) < 0
    ) {
      return res.status(400).json({ error: 'El efectivo contado es obligatorio y debe ser un número mayor o igual a 0' });
    }
    const contado = new Prisma.Decimal(String(efectivoContado));

    const resultado = await prisma.$transaction(async (tx) => {
      const pagosPendientes = await tx.pago.findMany({
        where: { cierreCajaId: null, fecha: { gte: rango.inicio, lte: rango.fin } },
        select: { id: true, monto: true, metodoPago: true },
      });

      const gastosPendientes = await tx.gasto.findMany({
        where: { cierreCajaId: null, fecha: { gte: rango.inicio, lte: rango.fin } },
        select: { id: true, monto: true, metodoPago: true },
      });

      // Solo hay "nada que cerrar" si NO hay pagos NI gastos. Un periodo
      // con únicamente gastos (un día sin ventas pero con una compra) es
      // un cierre válido
      if (pagosPendientes.length === 0 && gastosPendientes.length === 0) return null;

      const resumenIngresos = resumirPagos(pagosPendientes);
      // resumirPagos solo necesita una lista con monto y metodoPago, así
      // que sirve igual para los gastos (tienen exactamente esos campos)
      const resumenGastos = resumirPagos(gastosPendientes);

      const efectivoEsperado = resumenIngresos.totalEfectivo.minus(resumenGastos.totalEfectivo);

      const nuevoCierre = await tx.cierreCaja.create({
        data: {
          fechaDesde: rango.inicio,
          fechaHasta: rango.fin,
          totalGeneral: resumenIngresos.totalGeneral,
          totalEfectivo: resumenIngresos.totalEfectivo,
          totalGastos: resumenGastos.totalGeneral,
          totalGastosEfectivo: resumenGastos.totalEfectivo,
          efectivoContado: contado,
          // Negativo = faltante en caja, positivo = sobrante
          diferencia: contado.minus(efectivoEsperado),
          observaciones: observaciones || null,
          cerradoPorId,
        },
      });

      // Vinculamos pagos y gastos al cierre, exigiendo de nuevo que sigan
      // pendientes. Si algún conteo no coincide, otra persona los cerró
      // en el mismo instante: el throw deshace TODA la transacción
      const idsPagos = pagosPendientes.map((p) => p.id);
      const idsGastos = gastosPendientes.map((g) => g.id);

      const pagosActualizados = await tx.pago.updateMany({
        where: { id: { in: idsPagos }, cierreCajaId: null },
        data: { cierreCajaId: nuevoCierre.id },
      });
      const gastosActualizados = await tx.gasto.updateMany({
        where: { id: { in: idsGastos }, cierreCajaId: null },
        data: { cierreCajaId: nuevoCierre.id },
      });

      if (pagosActualizados.count !== idsPagos.length || gastosActualizados.count !== idsGastos.length) {
        throw new Error('CONFLICTO_CIERRE');
      }

      return {
        cierre: nuevoCierre,
        cantidadPagos: idsPagos.length,
        cantidadGastos: idsGastos.length,
      };
    });

    if (!resultado) {
      return res.status(400).json({ error: 'No hay pagos ni gastos pendientes de cierre en ese rango de fechas' });
    }

    res.status(201).json(resultado);
  } catch (error: any) {
    if (error.message === 'CONFLICTO_CIERRE') {
      return res.status(409).json({ error: 'Otro cierre modificó estos registros al mismo tiempo. Vuelve a previsualizar e intenta de nuevo' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al realizar el cierre' });
  }
});

router.get('/', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const cierres = await prisma.cierreCaja.findMany({
      include: {
        cerradoPor: { select: { nombre: true } },
        revertidoPor: { select: { nombre: true } },
        // _count: { select: { pagos: true } },
        _count: { select: { pagos: true, gastos: true } },
      },
      orderBy: { fechaCierre: 'desc' },
    });

    res.json(cierres);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los cierres' });
  }
});

/* router.get('/:id', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const cierre = await prisma.cierreCaja.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cerradoPor: { select: { nombre: true } },
        revertidoPor: { select: { nombre: true } },
        pagos: {
          include: {
            membresia: {
              include: {
                cliente: { select: { nombre: true, documento: true } },
                plan: { select: { nombre: true } },
              },
            },
            registradoPor: { select: { nombre: true } },
          },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!cierre) {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }

    res.json({ ...cierre, desglose: resumirPagos(cierre.pagos) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el cierre' });
  }
}); */

router.get('/:id', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const cierre = await prisma.cierreCaja.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cerradoPor: { select: { nombre: true } },
        revertidoPor: { select: { nombre: true } },
        pagos: {
          include: {
            membresia: {
              include: {
                cliente: { select: { nombre: true, documento: true } },
                plan: { select: { nombre: true } },
              },
            },
            registradoPor: { select: { nombre: true } },
          },
          orderBy: { fecha: 'asc' },
        },
        // Nuevo: los gastos que quedaron incluidos en este cierre
        gastos: {
          include: {
            categoria: { select: { nombre: true } },
            registradoPor: { select: { nombre: true } },
          },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!cierre) {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }

    res.json({
      ...cierre,
      // "desglose" sigue siendo el de ingresos, igual que antes, para no
      // romper lo que ya consume el frontend. El de gastos va aparte.
      // resumirPagos sirve para ambos porque solo necesita monto y metodoPago
      desglose: resumirPagos(cierre.pagos),
      desgloseGastos: resumirPagos(cierre.gastos),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el cierre' });
  }
});


// GET /cierres/:id/pdf — genera el "acta de cierre de caja": un documento
// imprimible con los totales, el desglose por método y la lista de pagos
// incluidos, pensado para archivar físicamente o firmar
// GET /cierres/:id/pdf — acta de cierre de caja, ahora con el cruce de
// ingresos y gastos: totales, efectivo esperado, y una tabla por cada lado
router.get('/:id/pdf', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const cierre = await prisma.cierreCaja.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cerradoPor: { select: { nombre: true } },
        revertidoPor: { select: { nombre: true } },
        pagos: {
          include: {
            membresia: {
              include: {
                cliente: { select: { nombre: true, documento: true } },
                plan: { select: { nombre: true } },
              },
            },
            registradoPor: { select: { nombre: true } },
          },
          orderBy: { fecha: 'asc' },
        },
        // Nuevo: los gastos incluidos en este cierre
        gastos: {
          include: {
            categoria: { select: { nombre: true } },
            registradoPor: { select: { nombre: true } },
          },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!cierre) {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }

    // dibujarTabla usa una altura de fila fija (20 puntos). Si una
    // descripción de gasto es larga (es texto libre), se partiría en varias
    // líneas y se encimaría con la fila siguiente. Por eso la recortamos
    // aquí, solo para el PDF; el texto completo sigue guardado en la base
    const recortar = (texto: string, max: number) =>
      texto.length > max ? `${texto.substring(0, max - 1)}…` : texto;

    const doc = crearPdf(res, `cierre-${cierre.id}.pdf`);

    dibujarEncabezado(
      doc,
      `Acta de cierre de caja #${cierre.id}`,
      `Periodo: ${formatearFechaPdf(cierre.fechaDesde)} al ${formatearFechaPdf(cierre.fechaHasta)}`
    );

    doc.fontSize(10);
    doc.text(`Realizado por: ${cierre.cerradoPor.nombre}`);
    doc.text(`Fecha de cierre: ${formatearFechaHoraPdf(cierre.fechaCierre)}`);

    if (cierre.revertido && cierre.revertidoPor && cierre.revertidoEn) {
      doc.moveDown(0.5);
      doc
        .fillColor('#cc0000')
        .font('Helvetica-Bold')
        .text('ESTE CIERRE FUE REVERTIDO')
        .font('Helvetica')
        .text(`Por: ${cierre.revertidoPor.nombre} — ${formatearFechaHoraPdf(cierre.revertidoEn)}`);
      if (cierre.motivoReversion) {
        doc.text(`Motivo: ${cierre.motivoReversion}`);
      }
      doc.fillColor('#000000');
    }

    // El efectivo esperado se recalcula con los mismos datos guardados en
    // el cierre (no se guardó como campo propio): efectivo de ingresos
    // menos efectivo de gastos. Decimal.minus mantiene la precisión exacta
    const efectivoEsperado = cierre.totalEfectivo.minus(cierre.totalGastosEfectivo);
    const resultadoNeto = cierre.totalGeneral.minus(cierre.totalGastos);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Resumen del periodo');
    doc.font('Helvetica');
    doc.text(`Total ingresos: ${formatearDineroPdf(cierre.totalGeneral.toString())}`);
    doc.text(`Total gastos: ${formatearDineroPdf(cierre.totalGastos.toString())}`);
    doc.text(`Resultado neto (ingresos - gastos): ${formatearDineroPdf(resultadoNeto.toString())}`);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Cuadre de caja (solo efectivo)');
    doc.font('Helvetica');
    doc.text(`Ingresos en efectivo: ${formatearDineroPdf(cierre.totalEfectivo.toString())}`);
    doc.text(`Gastos en efectivo: ${formatearDineroPdf(cierre.totalGastosEfectivo.toString())}`);
    doc.text(`Efectivo esperado en caja: ${formatearDineroPdf(efectivoEsperado.toString())}`);
    doc.text(`Efectivo contado: ${formatearDineroPdf(cierre.efectivoContado.toString())}`);
    const diferenciaNum = Number(cierre.diferencia);
    doc.text(
      `Diferencia: ${formatearDineroPdf(cierre.diferencia.toString())} (${diferenciaNum === 0 ? 'caja cuadrada' : diferenciaNum < 0 ? 'faltante' : 'sobrante'
      })`
    );

    if (cierre.observaciones) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Observaciones');
      doc.font('Helvetica').text(cierre.observaciones);
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Ingresos incluidos (${cierre.pagos.length})`);
    doc.moveDown(0.3);

    dibujarTabla(
      doc,
      [
        { titulo: 'Fecha', ancho: 70 },
        { titulo: 'Cliente', ancho: 130 },
        { titulo: 'Plan', ancho: 100 },
        { titulo: 'Método', ancho: 70 },
        { titulo: 'Monto', ancho: 80, alinearDerecha: true },
      ],
      cierre.pagos.map((pago) => [
        formatearFechaPdf(pago.fecha),
        pago.membresia.cliente.nombre,
        pago.membresia.plan.nombre,
        pago.metodoPago,
        formatearDineroPdf(pago.monto.toString()),
      ])
    );

    // Tabla de gastos: solo si el cierre tiene alguno, para no dejar un
    // título huérfano en cierres de periodos sin gastos
    if (cierre.gastos.length > 0) {
      doc.font('Helvetica-Bold').fontSize(10).text(`Gastos incluidos (${cierre.gastos.length})`);
      doc.moveDown(0.3);

      dibujarTabla(
        doc,
        [
          { titulo: 'Fecha', ancho: 65 },
          { titulo: 'Categoría', ancho: 90 },
          { titulo: 'Descripción', ancho: 170 },
          { titulo: 'Método', ancho: 60 },
          { titulo: 'Monto', ancho: 80, alinearDerecha: true },
        ],
        cierre.gastos.map((gasto) => [
          formatearFechaPdf(gasto.fecha),
          gasto.categoria.nombre,
          recortar(gasto.descripcion, 45),
          gasto.metodoPago,
          formatearDineroPdf(gasto.monto.toString()),
        ])
      );
    }

    doc.moveDown(2);
    const yFirmas = doc.y;
    doc
      .moveTo(doc.page.margins.left, yFirmas)
      .lineTo(doc.page.margins.left + 180, yFirmas)
      .stroke();
    doc
      .moveTo(doc.page.width - doc.page.margins.right - 180, yFirmas)
      .lineTo(doc.page.width - doc.page.margins.right, yFirmas)
      .stroke();
    doc.fontSize(9);
    doc.text('Firma de quien cierra', doc.page.margins.left, yFirmas + 5, { width: 180 });
    doc.text('Firma de quien recibe', doc.page.width - doc.page.margins.right - 180, yFirmas + 5, { width: 180 });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el PDF del cierre' });
  }
});

router.post('/:id/revertir', verificarToken, verificarRol('Administrador'), async (req: RequestConUsuario, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { password, motivo } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Debes confirmar tu contraseña para revertir un cierre' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Debes indicar el motivo de la reversión' });
    }

    const administrador = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });

    if (!administrador) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const passwordValida = await bcrypt.compare(password, administrador.password);
    if (!passwordValida) {
      return res.status(403).json({ error: 'Contraseña incorrecta' });
    }

    const cierreId = Number(req.params.id);

    const resultado = await prisma.$transaction(async (tx) => {
      const cierre = await tx.cierreCaja.findUnique({ where: { id: cierreId } });

      if (!cierre) return { tipo: 'no_encontrado' as const };
      if (cierre.revertido) return { tipo: 'ya_revertido' as const };

      await tx.pago.updateMany({
        where: { cierreCajaId: cierreId },
        data: { cierreCajaId: null },

      });

      // Los gastos también "sueltan" el cierre, igual que los pagos: vuelven
      // a quedar pendientes y pueden entrar a un cierre nuevo. Va dentro de
      // la misma transacción, así que se liberan juntos o no se libera nada
      await tx.gasto.updateMany({
        where: { cierreCajaId: cierreId },
        data: { cierreCajaId: null },
      });

      const cierreActualizado = await tx.cierreCaja.update({
        where: { id: cierreId },
        data: {
          revertido: true,
          revertidoEn: new Date(),
          revertidoPorId: administrador.id,
          motivoReversion: motivo.trim(),
        },
      });

      return { tipo: 'ok' as const, cierre: cierreActualizado };
    });

    if (resultado.tipo === 'no_encontrado') {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }
    if (resultado.tipo === 'ya_revertido') {
      return res.status(409).json({ error: 'Este cierre ya fue revertido anteriormente' });
    }

    res.json(resultado.cierre);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al revertir el cierre' });
  }
});

export default router;