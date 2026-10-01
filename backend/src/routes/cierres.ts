import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { verificarToken, verificarRol, RequestConUsuario } from '../middleware/auth';
import { rangoDeFechas } from '../utils/fechas';
import { resumirPagos } from '../utils/contabilidad';

const router = Router();

// Quiénes pueden operar la contabilidad. Las 4 rutas usan la misma lista
const ROLES_CONTABLES = ['Administrador', 'Recepcionista'];

const MENSAJE_RANGO_INVALIDO =
  'Indica ambas fechas en formato AAAA-MM-DD, con "desde" anterior o igual a "hasta"';

// IMPORTANTE: esta ruta va ANTES de "/:id". Express evalúa las rutas en
// orden, y si "/:id" estuviera primero, interpretaría la palabra
// "previsualizar" como si fuera un id
//
// GET /cierres/previsualizar?desde=...&hasta=...
// Muestra qué pagos entrarían en un cierre de ese rango (solo los que aún
// están pendientes) y sus totales, SIN guardar nada. Sirve para que el
// personal revise antes de contar la caja y confirmar
router.get('/previsualizar', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const rango = rangoDeFechas(req.query.desde, req.query.hasta);
    if (!rango) {
      return res.status(400).json({ error: MENSAJE_RANGO_INVALIDO });
    }

    const pagos = await prisma.pago.findMany({
      where: {
        cierreCajaId: null, // solo los que todavía no pertenecen a ningún cierre
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
});

// POST /cierres — realiza el cierre de caja del rango indicado.
// Body: { desde, hasta, efectivoContado, observaciones? }
router.post('/', verificarToken, verificarRol(...ROLES_CONTABLES), async (req: RequestConUsuario, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    // Lo guardamos en una constante ahora: dentro de la transacción de
    // abajo (una función anidada) TypeScript ya no "recuerda" que
    // req.usuario existe, pero una constante sí conserva su tipo
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

    // Transacción interactiva: recibe una función y todo lo que hagamos con
    // "tx" adentro se aplica junto, o no se aplica nada. La necesitamos
    // porque los pasos dependen uno del otro: los totales del cierre deben
    // calcularse con EXACTAMENTE los mismos pagos que luego se marcan como
    // cerrados
    const resultado = await prisma.$transaction(async (tx) => {
      const pendientes = await tx.pago.findMany({
        where: { cierreCajaId: null, fecha: { gte: rango.inicio, lte: rango.fin } },
        select: { id: true, monto: true, metodoPago: true },
      });

      // Nada que cerrar: devolvemos null y lo tratamos afuera como error 400
      if (pendientes.length === 0) return null;

      const resumen = resumirPagos(pendientes);

      const nuevoCierre = await tx.cierreCaja.create({
        data: {
          fechaDesde: rango.inicio,
          fechaHasta: rango.fin,
          totalGeneral: resumen.totalGeneral,
          totalEfectivo: resumen.totalEfectivo,
          efectivoContado: contado,
          // Negativo = faltante en caja, positivo = sobrante
          diferencia: contado.minus(resumen.totalEfectivo),
          observaciones: observaciones || null,
          cerradoPorId,
        },
      });

      // Vinculamos los pagos al cierre. Volvemos a exigir cierreCajaId null
      // en el filtro, y comparamos cuántos se actualizaron: si otra persona
      // cerró alguno de estos pagos en el mismo instante, el conteo no
      // coincide y abortamos (el throw deshace TODO lo hecho en la transacción)
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
});

// GET /cierres — historial de cierres, del más reciente al más antiguo
router.get('/', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const cierres = await prisma.cierreCaja.findMany({
      include: {
        cerradoPor: { select: { nombre: true } },
        // _count trae solo cuántos pagos incluyó cada cierre, sin cargarlos todos
        _count: { select: { pagos: true } },
      },
      orderBy: { fechaCierre: 'desc' },
    });

    res.json(cierres);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los cierres' });
  }
});

// GET /cierres/:id — detalle de un cierre: sus datos, todos los pagos que
// incluyó y el desglose por método de pago
router.get('/:id', verificarToken, verificarRol(...ROLES_CONTABLES), async (req, res) => {
  try {
    const cierre = await prisma.cierreCaja.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cerradoPor: { select: { nombre: true } },
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
});

// A propósito NO hay PUT ni DELETE: un cierre contable es un registro
// histórico y no se modifica ni se borra. Si hubo un error, se aclara en
// las observaciones del siguiente cierre

export default router;