import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';

const router = Router();

// GET /categorias-gasto — lista las categorías, para llenar el <select>
// al registrar un gasto. Administrador y Recepcionista (mismos roles
// que gestionan gastos)
router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const categorias = await prisma.categoriaGasto.findMany({ orderBy: { nombre: 'asc' } });
    res.json(categorias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las categorías de gasto' });
  }
});

// POST /categorias-gasto — crea una categoría nueva
router.post('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const nuevaCategoria = await prisma.categoriaGasto.create({ data: { nombre } });
    res.status(201).json(nuevaCategoria);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

// PUT /categorias-gasto/:id — edita el nombre de una categoría
router.put('/:id', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const categoriaActualizada = await prisma.categoriaGasto.update({
      where: { id: Number(id) },
      data: { nombre },
    });

    res.json(categoriaActualizada);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
});

// DELETE /categorias-gasto/:id — elimina una categoría
router.delete('/:id', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.categoriaGasto.delete({ where: { id: Number(id) } });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    // P2003: la categoría ya tiene gastos asociados, no se puede borrar
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: la categoría tiene gastos asociados' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
});

export default router;