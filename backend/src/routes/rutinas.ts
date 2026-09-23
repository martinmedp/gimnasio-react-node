import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken } from '../middleware/auth';

const router = Router();

// GET /rutinas/cliente/:clienteId — trae todas las rutinas de un cliente,
// cada una con sus ejercicios asignados
router.get('/cliente/:clienteId', verificarToken, async (req, res) => {
  try {
    const { clienteId } = req.params;

    const rutinas = await prisma.rutina.findMany({
      where: { clienteId: Number(clienteId) },
      include: {
        rutinaEjercicios: {
          include: { ejercicio: true },
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: { diaSemana: 'asc' },
    });

    res.json(rutinas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las rutinas del cliente' });
  }
});

// POST /rutinas — crea una nueva rutina para un cliente, asignada a un día específico
router.post('/', verificarToken, async (req, res) => {
  try {
    const { clienteId, nombre, diaSemana } = req.body;

    if (!clienteId || !nombre || !diaSemana) {
      return res.status(400).json({ error: 'clienteId, nombre y diaSemana son obligatorios' });
    }

    const nuevaRutina = await prisma.rutina.create({
      data: {
        clienteId: Number(clienteId),
        nombre,
        diaSemana,
      },
    });

    res.status(201).json(nuevaRutina);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Este cliente ya tiene una rutina asignada para ese día' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear la rutina' });
  }
});

// DELETE /rutinas/:id — elimina una rutina completa, junto con sus ejercicios
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rutinaId = Number(id);

    await prisma.$transaction([
      prisma.rutinaEjercicio.deleteMany({ where: { rutinaId } }),
      prisma.rutina.delete({ where: { id: rutinaId } }),
    ]);

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Rutina no encontrada' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la rutina' });
  }
});

// POST /rutinas/:rutinaId/ejercicios — agrega un ejercicio a una rutina existente
router.post('/:rutinaId/ejercicios', verificarToken, async (req, res) => {
  try {
    const { rutinaId } = req.params;
    const { ejercicioId, series, repeticiones, peso, orden } = req.body;

    if (!ejercicioId || !series || !repeticiones) {
      return res.status(400).json({ error: 'ejercicioId, series y repeticiones son obligatorios' });
    }

    const nuevoItem = await prisma.rutinaEjercicio.create({
      data: {
        rutinaId: Number(rutinaId),
        ejercicioId: Number(ejercicioId),
        series: Number(series),
        repeticiones: Number(repeticiones),
        peso: peso || null,
        orden: orden ? Number(orden) : 1,
      },
      include: { ejercicio: true },
    });

    res.status(201).json(nuevoItem);
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'La rutina o el ejercicio indicado no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al agregar el ejercicio a la rutina' });
  }
});

// PUT /rutinas/:rutinaId/ejercicios/:rutinaEjercicioId — edita series, repeticiones
// y/o peso de un ejercicio ya asignado a una rutina (no cambia el ejercicio en sí,
// solo estos datos de la asignación)
router.put('/:rutinaId/ejercicios/:rutinaEjercicioId', verificarToken, async (req, res) => {
  try {
    const { rutinaEjercicioId } = req.params;
    const { series, repeticiones, peso } = req.body;

    if (!series || !repeticiones) {
      return res.status(400).json({ error: 'Series y repeticiones son obligatorios' });
    }

    const itemActualizado = await prisma.rutinaEjercicio.update({
      where: { id: Number(rutinaEjercicioId) },
      data: {
        series: Number(series),
        repeticiones: Number(repeticiones),
        peso: peso || null,
      },
      include: { ejercicio: true }, // devolvemos también el ejercicio, para actualizar la vista de inmediato
    });

    res.json(itemActualizado);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Ese ejercicio no está asignado a la rutina' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el ejercicio de la rutina' });
  }
});

// DELETE /rutinas/:rutinaId/ejercicios/:rutinaEjercicioId — quita un ejercicio de una rutina
router.delete('/:rutinaId/ejercicios/:rutinaEjercicioId', verificarToken, async (req, res) => {
  try {
    const { rutinaEjercicioId } = req.params;

    await prisma.rutinaEjercicio.delete({
      where: { id: Number(rutinaEjercicioId) },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Ese ejercicio no está asignado a la rutina' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al quitar el ejercicio de la rutina' });
  }
});

export default router;