import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken } from '../middleware/auth';

const router = Router();

// GET /secciones-cuerpo — lista todas las secciones (Pecho, Espalda, Pierna, etc.)
// Este catálogo ya lo cargaste con datos desde Prisma Studio hace unos días
router.get('/', verificarToken, async (req, res) => {
  try {
    const secciones = await prisma.seccionCuerpo.findMany({
      orderBy: { nombre: 'asc' },
    });
    res.json(secciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las secciones del cuerpo' });
  }
});

export default router;