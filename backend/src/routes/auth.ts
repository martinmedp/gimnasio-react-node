import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const router = Router();

// POST /auth/login
// Recibe email y password, valida contra la BD, y si son correctos
// devuelve un token JWT que el frontend usará en las siguientes peticiones
router.post('/login', async (req, res) => {
  try {
    // Extraemos email y password del cuerpo de la petición (JSON enviado por React)
    const { email, password } = req.body;

    // Buscamos el usuario por email, trayendo también su Rol relacionado
    // (include funciona como el "with()" de Eloquent)
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { rol: true },
    });

    // Si no existe el usuario, no decimos "el email no existe" por seguridad
    // (evita que alguien deduzca qué emails están registrados)
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Comparamos la contraseña en texto plano recibida contra el hash guardado
    // bcrypt.compare regenera el hash internamente y compara, nunca "desencripta"
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generamos el token JWT: va firmado con nuestra clave secreta (JWT_SECRET)
    // Adentro guardamos solo datos no sensibles (nunca la contraseña ni su hash)
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol.nombre },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' } // el token deja de ser válido después de 8 horas
    );

    // Respondemos con el token y algunos datos básicos del usuario
    // (el frontend va a guardar el token para futuras peticiones)
    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

export default router;