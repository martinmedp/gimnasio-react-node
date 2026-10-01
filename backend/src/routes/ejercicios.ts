import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/ejercicios'));
  },
  filename: (req, file, cb) => {
    const nombreUnico = `${Date.now()}-${file.originalname}`;
    cb(null, nombreUnico);
  },
});

const upload = multer({ storage });

// GET /ejercicios — el catálogo se puede VER por cualquier rol logueado
// (incluido Cliente, para revisar cómo hacer sus ejercicios asignados)
router.get('/', verificarToken, async (req, res) => {
  try {
    const ejercicios = await prisma.ejercicio.findMany({
      include: { seccionCuerpo: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(ejercicios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los ejercicios' });
  }
});

// POST /ejercicios — crear ejercicios en el catálogo: Administrador y
// Entrenador (el experto en la materia). Recepcionista y Cliente, solo ver
router.post('/', verificarToken, verificarRol('Administrador', 'Entrenador'), upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, descripcion, seccionCuerpoId } = req.body;

    if (!nombre || !seccionCuerpoId) {
      return res.status(400).json({ error: 'Nombre y sección del cuerpo son obligatorios' });
    }

    const imagenUrl = req.file ? `/uploads/ejercicios/${req.file.filename}` : null;

    const nuevoEjercicio = await prisma.ejercicio.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        seccionCuerpoId: Number(seccionCuerpoId),
        imagenUrl,
      },
    });

    res.status(201).json(nuevoEjercicio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el ejercicio' });
  }
});

// PUT /ejercicios/:id — mismo criterio que crear: Administrador y Entrenador
router.put('/:id', verificarToken, verificarRol('Administrador', 'Entrenador'), upload.single('imagen'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, seccionCuerpoId } = req.body;

    if (!nombre || !seccionCuerpoId) {
      return res.status(400).json({ error: 'Nombre y sección del cuerpo son obligatorios' });
    }

    const datosActualizar: any = {
      nombre,
      descripcion: descripcion || null,
      seccionCuerpoId: Number(seccionCuerpoId),
    };

    if (req.file) {
      datosActualizar.imagenUrl = `/uploads/ejercicios/${req.file.filename}`;
    }

    const ejercicioActualizado = await prisma.ejercicio.update({
      where: { id: Number(id) },
      data: datosActualizar,
    });

    res.json(ejercicioActualizado);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el ejercicio' });
  }
});

// DELETE /ejercicios/:id — acción destructiva, exclusiva de Administrador
// (afecta rutinas existentes que lo usen)
router.delete('/:id', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.ejercicio.delete({
      where: { id: Number(id) },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: el ejercicio está usado en alguna rutina' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el ejercicio' });
  }
});

export default router;