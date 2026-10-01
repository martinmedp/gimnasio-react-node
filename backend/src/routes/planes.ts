import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';

const router = Router();

// GET /planes — lista los planes disponibles. Administrador y Recepcionista,
// quienes son los que inscriben clientes y necesitan ver el catálogo de precios
router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const planes = await prisma.plan.findMany({ orderBy: { nombre: 'asc' } });
    res.json(planes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los planes' });
  }
});

// POST /planes — crea un plan nuevo (mensual, anual o tiquetera)
router.post('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { nombre, tipo, precio, duracionDias, cantidadEntradas } = req.body;

    if (!nombre || !tipo || !precio) {
      return res.status(400).json({ error: 'Nombre, tipo y precio son obligatorios' });
    }

    // Validación de negocio: una tiquetera necesita cantidadEntradas;
    // los otros dos tipos (mensual/anual) no la usan. duracionDias aplica
    // a los TRES tipos (incluida la tiquetera, que también vence)
    if (tipo === 'tiquetera' && !cantidadEntradas) {
      return res.status(400).json({ error: 'Un plan de tiquetera requiere cantidadEntradas' });
    }

    const nuevoPlan = await prisma.plan.create({
      data: {
        nombre,
        tipo,
        precio,
        duracionDias: duracionDias ? Number(duracionDias) : null,
        cantidadEntradas: tipo === 'tiquetera' && cantidadEntradas ? Number(cantidadEntradas) : null,
      },
    });

    res.status(201).json(nuevoPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el plan' });
  }
});

// PUT /planes/:id — edita un plan existente
router.put('/:id', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, precio, duracionDias, cantidadEntradas } = req.body;

    if (tipo === 'tiquetera' && !cantidadEntradas) {
      return res.status(400).json({ error: 'Un plan de tiquetera requiere cantidadEntradas' });
    }

    const planActualizado = await prisma.plan.update({
      where: { id: Number(id) },
      data: {
        nombre,
        tipo,
        precio,
        duracionDias: duracionDias ? Number(duracionDias) : null,
        cantidadEntradas: tipo === 'tiquetera' && cantidadEntradas ? Number(cantidadEntradas) : null,
      },
    });

    res.json(planActualizado);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el plan' });
  }
});

// DELETE /planes/:id — acción destructiva, exclusiva de Administrador
router.delete('/:id', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.plan.delete({ where: { id: Number(id) } });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    // P2003: el plan ya tiene membresías asociadas, no se puede borrar
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: el plan tiene membresías asociadas' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el plan' });
  }
});

export default router;