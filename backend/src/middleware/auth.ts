import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extendemos el tipo Request de Express para poder guardar
// los datos del usuario autenticado dentro de la petición (req.usuario)
export interface RequestConUsuario extends Request {
  usuario?: { id: number; email: string; rol: string };
}

// Middleware que verifica que la petición traiga un token JWT válido
// Si es válido, deja pasar la petición (next()); si no, la corta con un error 401
export function verificarToken(req: RequestConUsuario, res: Response, next: NextFunction) {
  // El token viaja en el header Authorization, con el formato: "Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  // Separamos "Bearer" del token en sí
  const token = authHeader.split(' ')[1];

  try {
    // Verificamos la firma del token con nuestra clave secreta
    // Si el token fue alterado o expiró, esto lanza un error automáticamente
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      rol: string;
    };

    // Guardamos los datos del usuario en la petición, para que la ruta
    // final pueda usarlos (ej. saber quién hizo la petición)
    req.usuario = payload;

    next(); // deja continuar la petición hacia la ruta real
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}