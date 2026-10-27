import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

// Extendemos el tipo Request de Express para poder guardar
// los datos del usuario autenticado dentro de la petición (req.usuario)
export interface RequestConUsuario extends Request {
  usuario?: { id: number; email: string; rol: string; clienteId: number | null };
}

// Middleware que verifica que la petición traiga un token JWT válido
/* export function verificarToken(req: RequestConUsuario, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      rol: string;
      clienteId: number | null;
    };

    req.usuario = payload;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
} */
// Verifica que la petición traiga un token válido Y que la cuenta siga
// existiendo y activa. Antes solo se leía el token: si desactivabas o
// borrabas una cuenta, o le cambiabas el rol, el token ya emitido seguía
// valiendo hasta que vencía (8 horas). Ahora se consulta la base en cada
// petición (una búsqueda por clave primaria, muy liviana) y se usan los
// datos ACTUALES del usuario, no los que quedaron escritos en el token
export async function verificarToken(req: RequestConUsuario, res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization;

  if (!encabezado) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = encabezado.split(' ')[1];

  // Paso 1: comprobar la firma y la vigencia del token. Aquí solo
  // necesitamos saber de quién es (el id)
  let idUsuario: number;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
    idUsuario = payload.id;
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Paso 2: comprobar en la base que la cuenta existe y está activa
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: idUsuario },
      select: { id: true, email: true, activo: true, clienteId: true, rol: { select: { nombre: true } } },
    });

    // Cuenta eliminada o desactivada: 401, igual que un token vencido.
    // La pantalla ya sabe qué hacer con un 401: cerrar la sesión y llevar al login
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'La cuenta está desactivada o ya no existe' });
    }

    // El rol y el clienteId vienen de la base, no del token: si el
    // Administrador los cambia, la nueva configuración vale de inmediato
    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre,
      clienteId: usuario.clienteId,
    };

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar la sesión' });
  }
}



// verificarRol es una "fábrica de middlewares": recibe los roles permitidos
// y devuelve el middleware real. Se usa así: verificarRol('Administrador'),
// SIEMPRE después de verificarToken en la cadena de una ruta.
//
// 401 (Unauthorized) = "no sé quién eres" (sin token o inválido)
// 403 (Forbidden) = "sé quién eres, pero no tienes permiso para esto"
export function verificarRol(...rolesPermitidos: string[]) {
  return (req: RequestConUsuario, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
    }

    next();
  };
}

// verificarPropioCliente: para rutas donde un Cliente solo puede ver/tocar
// SU PROPIA información. Se usa junto con verificarRol('Cliente', ...otrosRoles)
// cuando la ruta debe combinar "solo lo mío" (para Cliente) con acceso
// completo (para personal). El parámetro obtenerClienteId es una función que
// le dice a este middleware CÓMO extraer el clienteId relevante de la ruta
// (por ejemplo, desde req.params.id en una ruta como /clientes/:id)
export function verificarPropioCliente(obtenerClienteIdDeRuta: (req: RequestConUsuario) => number) {
  return (req: RequestConUsuario, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Si el usuario NO es Cliente (es personal del gimnasio), este chequeo
    // no aplica: dejamos pasar sin restricción adicional
    if (req.usuario.rol !== 'Cliente') {
      return next();
    }

    // Si es Cliente, comparamos el clienteId de su token contra el
    // clienteId que pide la ruta actual. Si no coinciden, es prohibido
    const clienteIdDeLaRuta = obtenerClienteIdDeRuta(req);

    if (req.usuario.clienteId !== clienteIdDeLaRuta) {
      return res.status(403).json({ error: 'Solo puedes acceder a tu propia información' });
    }

    next();
  };
}