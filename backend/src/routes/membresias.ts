import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol, verificarPropioCliente } from '../middleware/auth';

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