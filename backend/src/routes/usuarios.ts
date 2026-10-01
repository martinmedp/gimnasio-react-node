import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma';
import { verificarToken, verificarRol } from '../middleware/auth';

const router = Router();

// GET /usuarios — lista SOLO cuentas de personal (Administrador,
// Recepcionista, Entrenador). Las cuentas de Cliente ahora se gestionan
// desde la pantalla de Clientes, no aquí — por eso las excluimos con
// "not: { nombre: 'Cliente' }" dentro del filtro por rol relacionado
router.get('/', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { rol: { nombre: { not: 'Cliente' } } },
      include: { rol: true },
      orderBy: { nombre: 'asc' },
    });

    const usuariosSinPassword = usuarios.map(({ password, ...resto }) => resto);

    res.json(usuariosSinPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

router.post('/', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { nombre, email, password, rolId } = req.body;

    if (!nombre || !email || !password || !rolId) {
      return res.status(400).json({ error: 'nombre, email, password y rolId son obligatorios' });
    }

    const rolSeleccionado = await prisma.rol.findUnique({ where: { id: Number(rolId) } });
    if (rolSeleccionado?.nombre === 'Cliente') {
      return res.status(400).json({ error: 'Los usuarios Cliente se crean mediante el registro público, no aquí' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoUsuario = await prisma.usuario.create({
      data: { nombre, email, password: passwordHash, rolId: Number(rolId), activo: true },
      include: { rol: true },
    });

    const { password: _sinUsar, ...usuarioSinPassword } = nuevoUsuario;
    res.status(201).json(usuarioSinPassword);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

router.put('/:id', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, password, rolId } = req.body;

    const datosActualizar: any = { nombre, email, rolId: Number(rolId) };

    if (password) {
      datosActualizar.password = await bcrypt.hash(password, 10);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: Number(id) },
      data: datosActualizar,
      include: { rol: true },
    });

    const { password: _sinUsar, ...usuarioSinPassword } = usuarioActualizado;
    res.json(usuarioSinPassword);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

router.delete('/:id', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.usuario.delete({ where: { id: Number(id) } });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});

export default router;