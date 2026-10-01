import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const router = Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { rol: true },
    });

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Nueva validación: si la cuenta no está activa (típico de un Cliente
    // recién auto-registrado, pendiente de aprobación), se rechaza el login
    // con un mensaje claro, aunque la contraseña sea correcta
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Tu cuenta está pendiente de activación por un administrador' });
    }

    // El token ahora incluye también clienteId, para que verificarPropioCliente
    // pueda comparar "el cliente del token" contra "el cliente de la ruta"
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol.nombre,
        clienteId: usuario.clienteId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol.nombre,
        clienteId: usuario.clienteId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// POST /auth/registro-cliente — auto-registro público, SIN token requerido
// (cualquier persona puede acceder a este endpoint, es el equivalente a la
// pantalla de "Crear cuenta" de una app pública)
router.post('/registro-cliente', async (req, res) => {
  try {
    const { nombre, documento, email, telefono, password } = req.body;

    if (!nombre || !documento || !email || !password) {
      return res.status(400).json({ error: 'Nombre, documento, email y password son obligatorios' });
    }

    // Buscamos el rol "Cliente" por nombre, ya que no conocemos su id de antemano
    // (el id depende del orden en que se crearon los roles en cada instalación)
    const rolCliente = await prisma.rol.findUnique({ where: { nombre: 'Cliente' } });

    if (!rolCliente) {
      // Esto solo pasaría si alguien borró el rol Cliente de la base de datos.
      // Es un error de configuración del sistema, no del usuario que se registra
      return res.status(500).json({ error: 'El rol Cliente no está configurado en el sistema' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // $transaction: creamos el Cliente y el Usuario como una sola operación
    // atómica. Si falla la creación del Usuario (ej. email duplicado),
    // el Cliente tampoco debe quedar creado a medias
    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoCliente = await tx.cliente.create({
        data: {
          nombre,
          documento,
          email,
          telefono: telefono || null,
          estado: 'pendiente', // distinto del default "activo": indica que falta aprobación
        },
      });

      const nuevoUsuario = await tx.usuario.create({
        data: {
          nombre,
          email,
          password: passwordHash,
          rolId: rolCliente.id,
          clienteId: nuevoCliente.id,
          activo: false, // nace inactivo: no puede iniciar sesión hasta ser aprobado
        },
      });

      return { cliente: nuevoCliente, usuario: nuevoUsuario };
    });

    res.status(201).json({
      mensaje: 'Registro exitoso. Tu cuenta será activada por un administrador antes de que puedas iniciar sesión.',
      clienteId: resultado.cliente.id,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese documento o email' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la cuenta' });
  }
});

export default router;