import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken } from '../middleware/auth';

const router = Router();

// GET /clientes — lista todos los clientes
router.get('/', verificarToken, async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany();
    res.json(clientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los clientes' });
  }
});

// GET /clientes/:id — trae un solo cliente por su id
// Lo necesitamos, por ejemplo, para mostrar su nombre en la pantalla de Progreso
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // findUnique busca por un campo único (en este caso, la llave primaria)
    // y devuelve null si no encuentra nada, a diferencia de findMany que devuelve []
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(id) },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el cliente' });
  }
});

// POST /clientes — crea un nuevo cliente
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nombre, documento, telefono, email, fechaNacimiento, estatura } = req.body;

    if (!nombre || !documento) {
      return res.status(400).json({ error: 'Nombre y documento son obligatorios' });
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre,
        documento,
        telefono: telefono || null,
        email: email || null,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        estatura: estatura && !isNaN(Number(estatura)) ? Number(estatura) : null,
      },
    });

    res.status(201).json(nuevoCliente);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un cliente con ese documento' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
});

// PUT /clientes/:id — actualiza un cliente existente
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, documento, telefono, email, fechaNacimiento, estatura, estado } = req.body;

    const clienteActualizado = await prisma.cliente.update({
      where: { id: Number(id) },
      data: {
        nombre,
        documento,
        telefono: telefono || null,
        email: email || null,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        estatura: estatura && !isNaN(Number(estatura)) ? Number(estatura) : null,
        estado,
      },
    });

    res.json(clienteActualizado);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un cliente con ese documento' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
});

// DELETE /clientes/:id — elimina un cliente
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.cliente.delete({
      where: { id: Number(id) },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: el cliente tiene registros relacionados (membresías, asistencias o rutinas)' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
});

export default router;