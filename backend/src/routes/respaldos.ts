import { Router } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import prisma from '../prisma';
import { verificarToken, verificarRol, RequestConUsuario } from '../middleware/auth';
import { validarCuerpo } from '../utils/validar';
import { CARPETA_RESPALDOS, ejecutarRespaldo, hayRespaldoEnCurso, RespaldoEnCursoError } from '../utils/respaldo';
import { leerConfiguracion, reprogramar } from '../utils/programador';

const router = Router();

// TODAS las rutas de este archivo son solo para el Administrador:
// router.use aplica estos dos controles a todo lo que se defina abajo
router.use(verificarToken, verificarRol('Administrador'));

// Cuerpo de PUT /respaldos/configuracion. La hora debe ser "HH:mm" de 00:00 a 23:59
const esquemaConfiguracion = z.object({
  activo: z.boolean({
    required_error: 'Indica si el respaldo automático está activo',
    invalid_type_error: 'El valor de "activo" debe ser verdadero o falso',
  }),
  hora: z
    .string({ required_error: 'La hora es obligatoria' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener el formato HH:mm, por ejemplo 20:00'),
});

// GET /respaldos — configuración, si hay un respaldo en curso y el
// historial de los últimos 50 intentos
router.get('/', async (req, res) => {
  try {
    const [configuracion, respaldos] = await Promise.all([
      leerConfiguracion(),
      prisma.respaldo.findMany({
        orderBy: { creadoEn: 'desc' },
        take: 50,
        include: { creadoPor: { select: { nombre: true } } },
      }),
    ]);

    res.json({
      configuracion,
      enCurso: hayRespaldoEnCurso(),
      respaldos: respaldos.map((respaldo) => ({
        ...respaldo,
        // ¿El archivo sigue en el disco? (puede haberse borrado por rotación o a mano)
        disponible: !!respaldo.archivo && fs.existsSync(path.join(CARPETA_RESPALDOS, path.basename(respaldo.archivo))),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los respaldos' });
  }
});

// POST /respaldos — "Respaldar ahora". Puede tardar unos segundos
router.post('/', async (req: RequestConUsuario, res) => {
  try {
    const resultado = await ejecutarRespaldo('manual', req.usuario?.id ?? null);

    if (!resultado.ok) {
      return res.status(500).json({ error: resultado.mensaje ?? 'No se pudo crear el respaldo' });
    }

    res.status(201).json(resultado.registro);
  } catch (error) {
    if (error instanceof RespaldoEnCursoError) {
      return res.status(409).json({ error: 'Ya hay un respaldo en curso. Espera a que termine.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear el respaldo' });
  }
});

// PUT /respaldos/configuracion — activar o desactivar el respaldo diario y
// elegir su hora. Reprograma el reloj al instante, sin reiniciar nada
router.put('/configuracion', validarCuerpo(esquemaConfiguracion), async (req, res) => {
  try {
    const { activo, hora } = req.body;

    const configuracion = await prisma.configuracionRespaldo.upsert({
      where: { id: 1 },
      update: { activo, hora },
      create: { id: 1, activo, hora },
    });

    reprogramar(configuracion);
    res.json(configuracion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

// POST /respaldos/:id/descargar — descarga un respaldo. Es un POST (y no
// un GET) para que la contraseña viaje en el cuerpo y no en la dirección.
// Un respaldo contiene todos los datos personales de los clientes, así que,
// igual que al revertir un cierre, se pide la contraseña del Administrador
router.post('/:id/descargar', async (req: RequestConUsuario, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Debes confirmar tu contraseña para descargar un respaldo' });
    }

    const administrador = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!administrador || !(await bcrypt.compare(password, administrador.password))) {
      return res.status(403).json({ error: 'Contraseña incorrecta' });
    }

    const respaldo = await prisma.respaldo.findUnique({ where: { id: Number(req.params.id) } });
    if (!respaldo || !respaldo.archivo) {
      return res.status(404).json({ error: 'El archivo de este respaldo ya no está disponible' });
    }

    // basename: aunque el nombre guardado fuera raro, solo se usa el nombre
    // del archivo, nunca una ruta. La ruta completa la arma el servidor
    const nombre = path.basename(respaldo.archivo);
    const ruta = path.join(CARPETA_RESPALDOS, nombre);

    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ error: 'El archivo de este respaldo ya no está en el servidor' });
    }

    console.log(`[respaldos] ${administrador.email} descargó ${nombre}`);
    res.download(ruta, nombre);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al descargar el respaldo' });
  }
});

export default router;