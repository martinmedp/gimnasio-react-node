import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extendemos el tipo Request de Express para poder guardar
// los datos del usuario autenticado dentro de la petición (req.usuario)
export interface RequestConUsuario extends Request {
  usuario?: { id: number; email: string; rol: string; clienteId: number | null };
}

// Middleware que verifica que la petición traiga un token JWT válido
export function verificarToken(req: RequestConUsuario, res: Response, next: NextFunction) {
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