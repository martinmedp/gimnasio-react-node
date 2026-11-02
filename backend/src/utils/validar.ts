import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

// Fábrica de middleware: recibe un "esquema" (la descripción de cómo debe
// ser el cuerpo de la petición) y devuelve un middleware que lo comprueba.
// Si el cuerpo no cumple, responde 400 con un mensaje claro y la ruta ni
// siquiera se ejecuta. Si cumple, deja pasar la petición tal cual.
//
// Se coloca en la ruta DESPUÉS de verificarToken/verificarRol, para
// validar solo las peticiones de quien tiene permiso.
//
// No reemplaza req.body por la versión "limpia" de zod: así no se pierden
// campos que la ruta use y el esquema no mencione
export function validarCuerpo(esquema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    // "?? {}": si la petición no trae cuerpo, req.body puede ser undefined
    const resultado = esquema.safeParse(req.body ?? {});

    if (!resultado.success) {
      const problemas = resultado.error.issues.map((problema) => ({
        campo: problema.path.join('.'),
        mensaje: problema.message,
      }));

      // "error" lleva el primer problema (es lo que muestran las pantallas);
      // "detalles" trae la lista completa por si se necesita
      return res.status(400).json({ error: problemas[0].mensaje, detalles: problemas });
    }

    next();
  };
}