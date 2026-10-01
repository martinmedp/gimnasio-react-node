import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';

const router = Router();

// GET /entrenadores — lista todos los entrenadores con su horario.
// Sin restricción de rol más allá de estar logueado: cualquier usuario
// (incluido Cliente) puede consultar la disponibilidad
router.get('/', verificarToken, async (req, res) => {
  try {
    const entrenadores = await prisma.entrenador.findMany({
      include: { horarios: { orderBy: { diaSemana: 'asc' } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(entrenadores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los entrenadores' });
  }
});

// POST /entrenadores — crea un entrenador nuevo. Es información de
// personal (como Usuario), así que se restringe a Administrador
router.post('/', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { nombre, especialidad, telefono } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const nuevoEntrenador = await prisma.entrenador.create({
      data: { nombre, especialidad: especialidad || null, telefono: telefono || null },
    });

    res.status(201).json(nuevoEntrenador);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el entrenador' });
  }
});

// PUT /entrenadores/:id — edita nombre, especialidad o teléfono
router.put('/:id', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, especialidad, telefono } = req.body;

    const entrenadorActualizado = await prisma.entrenador.update({
      where: { id: Number(id) },
      data: { nombre, especialidad: especialidad || null, telefono: telefono || null },
    });

    res.json(entrenadorActualizado);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el entrenador' });
  }
});

// DELETE /entrenadores/:id — elimina un entrenador (y, por la relación en
// cascada del schema... en realidad NO hay cascada configurada, así que
// primero hay que borrar sus horarios, igual que hicimos con Rutina)
router.delete('/:id', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const entrenadorId = Number(id);

    await prisma.$transaction([
      prisma.horarioEntrenador.deleteMany({ where: { entrenadorId } }),
      prisma.entrenador.delete({ where: { id: entrenadorId } }),
    ]);

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el entrenador' });
  }
});

// POST /entrenadores/:id/horarios — agrega un bloque de horario a un entrenador
router.post('/:id/horarios', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { diaSemana, horaInicio, horaFin } = req.body;

    if (!diaSemana || !horaInicio || !horaFin) {
      return res.status(400).json({ error: 'diaSemana, horaInicio y horaFin son obligatorios' });
    }

    const nuevoHorario = await prisma.horarioEntrenador.create({
      data: { entrenadorId: Number(id), diaSemana, horaInicio, horaFin },
    });

    res.status(201).json(nuevoHorario);
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'El entrenador indicado no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al agregar el horario' });
  }
});

// DELETE /entrenadores/:entrenadorId/horarios/:horarioId — quita un bloque de horario
router.delete('/:entrenadorId/horarios/:horarioId', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { horarioId } = req.params;

    await prisma.horarioEntrenador.delete({ where: { id: Number(horarioId) } });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el horario' });
  }
});

export default router;