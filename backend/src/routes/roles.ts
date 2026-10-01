import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';

const router = Router();

// GET /roles — lista los 4 roles disponibles, para llenar un <select>
// al crear/editar un usuario de personal. Solo Administrador
router.get('/', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const roles = await prisma.rol.findMany({ orderBy: { nombre: 'asc' } });
    res.json(roles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los roles' });
  }
});

export default router;