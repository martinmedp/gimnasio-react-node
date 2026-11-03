import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol, verificarPropioCliente } from '../middleware/auth';
import { validarCuerpo } from '../utils/validar';
import { esquemaPagoMembresia } from '../utils/esquemas';

const router = Router();

const DIAS_ALERTA_VENCIMIENTO = 5;

function calcularAlerta(fechaFin: Date | null): 'proxima' | 'vencida' | null {
  if (!fechaFin) return null;
  const hoy = new Date();
  const diffMs = fechaFin.getTime() - hoy.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return 'vencida';
  if (diffDias <= DIAS_ALERTA_VENCIMIENTO) return 'proxima';
  return null;
}

// Ruta exclusiva del CLIENTE. Un Cliente solo debe ver sus pagos VÁLIDOS y
// sus datos básicos: los pagos anulados, el motivo de la anulación, quién
// anuló y el cierre de caja son información interna del gimnasio.
//
// Con "select" se pide campo por campo lo que el Cliente puede ver, en vez
// de pedir todo y ocultar algo después: lo que no se pide, no viaja.
// Para el personal esta ruta no hace nada: next() pasa a la de abajo.
// (Costo: para el personal la sesión se verifica dos veces en esta
// dirección. Es una consulta liviana por clave primaria.)
router.get('/cliente/:clienteId', verificarToken, async (req: any, res, next) => {
  try {
    if (req.usuario?.rol !== 'Cliente') {
      return next();
    }

    // Un Cliente solo accede a su propia información
    if (req.usuario.clienteId !== Number(req.params.clienteId)) {
      return res.status(403).json({ error: 'Solo puedes acceder a tu propia información' });
    }

    const membresias = await prisma.membresia.findMany({
      where: { clienteId: req.usuario.clienteId },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        entradasRestantes: true,
        estado: true,
        plan: { select: { id: true, nombre: true, tipo: true, precio: true } },
        pagos: {
          where: { anulado: false },
          select: {
            id: true,
            monto: true,
            fecha: true,
            metodoPago: true,
            registradoPor: { select: { nombre: true } },
          },
          orderBy: { fecha: 'asc' },
        },
      },
      orderBy: { fechaInicio: 'desc' },
    });

    // Alerta de vencimiento: solo para membresías activas. Vencida si la
    // fecha de fin ya pasó; próxima si faltan 5 días o menos
    const ahora = Date.now();
    const conAlerta = membresias.map((membresia) => {
      let alerta: 'proxima' | 'vencida' | null = null;
      if (membresia.estado === 'activa' && membresia.fechaFin) {
        const dias = Math.ceil((membresia.fechaFin.getTime() - ahora) / (1000 * 60 * 60 * 24));
        if (dias < 0) alerta = 'vencida';
        else if (dias <= 5) alerta = 'proxima';
      }
      return { ...membresia, alerta };
    });

    res.json(conAlerta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las membresías' });
  }
});




// GET /membresias/cliente/:clienteId — Administrador, Recepcionista, y el
// propio Cliente pueden VER el historial; solo lectura para todos
router.get(
  '/cliente/:clienteId',
  verificarToken,
  verificarRol('Administrador', 'Recepcionista', 'Cliente'),
  verificarPropioCliente((req) => Number(req.params.clienteId)),
  async (req, res) => {
    try {
      const { clienteId } = req.params;

      const membresias = await prisma.membresia.findMany({
        where: { clienteId: Number(clienteId) },
        include: {
          plan: true,
          // Ahora incluimos, dentro de cada pago, los datos básicos de
          // quién lo registró — así el cliente puede ver "quién lo atendió"
          pagos: { include: { registradoPor: { select: { nombre: true } } } },
        },
        orderBy: { fechaInicio: 'desc' },
      });

      const membresiasConAlerta = membresias.map((membresia) => ({
        ...membresia,
        alerta: calcularAlerta(membresia.fechaFin),
      }));

      res.json(membresiasConAlerta);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener las membresías del cliente' });
    }
  }
);

// POST /membresias — inscribir: exclusivo de Administrador y Recepcionista
router.post('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { clienteId, planId } = req.body;

    if (!clienteId || !planId) {
      return res.status(400).json({ error: 'clienteId y planId son obligatorios' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const fechaInicio = new Date();

    let fechaFin: Date | null = null;
    if (plan.duracionDias) {
      fechaFin = new Date(fechaInicio);
      fechaFin.setDate(fechaFin.getDate() + plan.duracionDias);
    }

    const entradasRestantes = plan.tipo === 'tiquetera' ? plan.cantidadEntradas : null;

    const nuevaMembresia = await prisma.membresia.create({
      data: {
        clienteId: Number(clienteId),
        planId: Number(planId),
        fechaInicio,
        fechaFin,
        entradasRestantes,
      },
      include: { plan: true, pagos: true },
    });

    res.status(201).json({ ...nuevaMembresia, alerta: calcularAlerta(nuevaMembresia.fechaFin) });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'El cliente o el plan indicado no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear la membresía' });
  }
});

// PUT /membresias/:id/estado — cambiar estado: Administrador y Recepcionista
router.put('/:id/estado', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ error: 'El estado es obligatorio' });
    }

    const membresiaActualizada = await prisma.membresia.update({
      where: { id: Number(id) },
      data: { estado },
      include: { plan: true, pagos: true },
    });

    res.json({ ...membresiaActualizada, alerta: calcularAlerta(membresiaActualizada.fechaFin) });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Membresía no encontrada' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el estado de la membresía' });
  }
});

// Guardia: una membresía solo puede tener UN pago válido (no anulado).
// Hasta ahora solo lo impedía la pantalla (ocultaba el botón); aquí lo
// exige el backend. Si el pago fue un error, hay que anularlo primero
// router.post('/:id/pagos', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res, next) => {
router.post('/:id/pagos', verificarToken, verificarRol('Administrador', 'Recepcionista'), validarCuerpo(esquemaPagoMembresia), async (req, res, next) => {
  try {
    const pagoValido = await prisma.pago.findFirst({
      where: { membresiaId: Number(req.params.id), anulado: false },
    });

    if (pagoValido) {
      return res.status(409).json({
        error: 'Esta membresía ya tiene un pago registrado. Si hubo un error, anúlalo primero',
      });
    }

    // Sin pago válido: next() pasa a la ruta que registra el pago
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al validar el pago de la membresía' });
  }
});

// POST /membresias/:id/pagos — registrar pago: Administrador y Recepcionista.
// Ahora también guarda QUIÉN lo registró, usando req.usuario (llenado por
// verificarToken a partir del JWT) — no confiamos en que el frontend
// envíe ese dato, lo tomamos directamente de la sesión autenticada
router.post('/:id/pagos', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { metodoPago } = req.body;

    if (!metodoPago) {
      return res.status(400).json({ error: 'El método de pago es obligatorio' });
    }

    const membresia = await prisma.membresia.findUnique({
      where: { id: Number(id) },
      include: { plan: true },
    });

    if (!membresia) {
      return res.status(404).json({ error: 'Membresía no encontrada' });
    }

    const nuevoPago = await prisma.pago.create({
      data: {
        membresiaId: Number(id),
        monto: membresia.plan.precio,
        metodoPago,
        // req.usuario.id viene del token JWT, verificado por verificarToken
        // más arriba en la cadena de middlewares. Es imposible de falsificar
        // desde el frontend sin tener una sesión válida de ese usuario
        registradoPorId: req.usuario.id,
      },
      include: { registradoPor: { select: { nombre: true } } },
    });

    res.status(201).json(nuevoPago);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

export default router;