import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import bcrypt from 'bcrypt';
import prisma from '../prisma';
import { verificarToken, verificarRol, verificarPropioCliente } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/clientes'));
  },
  filename: (req, file, cb) => {
    const nombreUnico = `${Date.now()}-${file.originalname}`;
    cb(null, nombreUnico);
  },
});

const upload = multer({ storage });

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

router.get('/', verificarToken, verificarRol('Administrador', 'Recepcionista', 'Entrenador'), async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        membresias: { where: { estado: 'activa' } },
        usuario: { select: { email: true, activo: true } },
      },
    });

    const clientesConAlerta = clientes.map((cliente) => {
      const tieneAlerta = cliente.membresias.some((m) => calcularAlerta(m.fechaFin) !== null);
      const alertaVencida = cliente.membresias.some((m) => calcularAlerta(m.fechaFin) === 'vencida');
      const { membresias, ...clienteSinMembresias } = cliente;

      return {
        ...clienteSinMembresias,
        alertaMembresia: tieneAlerta,
        alertaMembresiaVencida: alertaVencida,
      };
    });

    res.json(clientesConAlerta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los clientes' });
  }
});

router.get(
  '/:id',
  verificarToken,
  verificarRol('Administrador', 'Recepcionista', 'Entrenador', 'Cliente'),
  verificarPropioCliente((req) => Number(req.params.id)),
  async (req, res) => {
    try {
      const { id } = req.params;

      const cliente = await prisma.cliente.findUnique({
        where: { id: Number(id) },
        include: { usuario: { select: { email: true, activo: true } } },
      });

      if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      res.json(cliente);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener el cliente' });
    }
  }
);

router.post('/', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
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

router.put('/:id', verificarToken, verificarRol('Administrador', 'Recepcionista'), async (req, res) => {
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

router.put(
  '/:id/foto',
  verificarToken,
  verificarRol('Administrador', 'Recepcionista', 'Entrenador', 'Cliente'),
  verificarPropioCliente((req) => Number(req.params.id)),
  upload.single('foto'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No se envió ninguna imagen' });
      }

      const fotoUrl = `/uploads/clientes/${req.file.filename}`;

      const clienteActualizado = await prisma.cliente.update({
        where: { id: Number(id) },
        data: { fotoUrl },
      });

      res.json(clienteActualizado);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      console.error(error);
      res.status(500).json({ error: 'Error al actualizar la foto' });
    }
  }
);

// POST /clientes/:id/cuenta — crea una cuenta de acceso para un cliente
// que YA EXISTE y todavía no tiene ninguna (no pasó por el auto-registro).
// Queda con exactamente los mismos campos que una cuenta auto-registrada:
// rol Cliente, vinculada a este Cliente, y ACTIVA de una vez (a diferencia
// del auto-registro, aquí es el propio Administrador quien la está dando
// de alta, así que no tiene sentido dejarla pendiente de su propia aprobación).
// Administrador
router.post('/:id/cuenta', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(id) },
      include: { usuario: true },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (cliente.usuario) {
      return res.status(409).json({ error: 'Este cliente ya tiene una cuenta de acceso' });
    }

    const rolCliente = await prisma.rol.findUnique({ where: { nombre: 'Cliente' } });
    if (!rolCliente) {
      return res.status(500).json({ error: 'El rol Cliente no está configurado en el sistema' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre: cliente.nombre,
        email,
        password: passwordHash,
        rolId: rolCliente.id,
        clienteId: cliente.id,
        activo: true, // creada por el Administrador: activa de inmediato, sin pasar por aprobación
      },
      select: { email: true, activo: true },
    });

    res.status(201).json(nuevoUsuario);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear la cuenta de acceso' });
  }
});

router.put('/:id/cuenta/estado', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const usuarioVinculado = await prisma.usuario.findUnique({
      where: { clienteId: Number(id) },
    });

    if (!usuarioVinculado) {
      return res.status(404).json({ error: 'Este cliente no tiene una cuenta de acceso' });
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: usuarioVinculado.id },
      data: { activo: !!activo },
      select: { email: true, activo: true },
    });

    res.json(usuarioActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar el estado de la cuenta' });
  }
});

router.put('/:id/cuenta/password', verificarToken, verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const usuarioVinculado = await prisma.usuario.findUnique({
      where: { clienteId: Number(id) },
    });

    if (!usuarioVinculado) {
      return res.status(404).json({ error: 'Este cliente no tiene una cuenta de acceso' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.usuario.update({
      where: { id: usuarioVinculado.id },
      data: { password: passwordHash },
    });

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

router.delete('/:id', verificarToken, verificarRol('Administrador'), async (req, res) => {
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