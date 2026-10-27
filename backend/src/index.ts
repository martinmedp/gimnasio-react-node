import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { ErrorDeSubida } from './utils/subidas';
import clientesRouter from './routes/clientes';
import authRouter from './routes/auth';
import medidasRouter from './routes/medidas';
import ejerciciosRouter from './routes/ejercicios';
import seccionesCuerpoRouter from './routes/seccionesCuerpo';
import rutinasRouter from './routes/rutinas';
import usuariosRouter from './routes/usuarios';
import rolesRouter from './routes/roles';
import planesRouter from './routes/planes';
import membresiasRouter from './routes/membresias';
import asistenciasRouter from './routes/asistencias';
import entrenadoresRouter from './routes/entrenadores';
import pagosRouter from './routes/pagos';
import cierresRouter from './routes/cierres';
import categoriasGastoRouter from './routes/categoriasGasto';
import gastosRouter from './routes/gastos';
import estadisticasRouter from './routes/estadisticas';

const app = express();
const PORT = 3000;

// Cabeceras de seguridad estándar. Excepción necesaria: se permite que el
// frontend (otro origen) cargue las imágenes de /uploads
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: solo el frontend puede usar la API desde un navegador
app.use(cors({ origin: [process.env.FRONTEND_URL ?? 'http://localhost:5173'] }));

app.use(express.json());

// Límite de intentos en el login: 10 fallidos cada 15 minutos por dirección
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Intenta de nuevo en unos 15 minutos.' },
});

// Límite en el registro público: 5 solicitudes por hora por dirección
const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde este equipo. Intenta de nuevo más tarde.' },
});

app.use('/auth/login', limitadorLogin);
app.use('/auth/registro-cliente', limitadorRegistro);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando correctamente' });
});

app.use('/clientes', clientesRouter);
app.use('/auth', authRouter);
app.use('/medidas', medidasRouter);
app.use('/ejercicios', ejerciciosRouter);
app.use('/secciones-cuerpo', seccionesCuerpoRouter);
app.use('/rutinas', rutinasRouter);
app.use('/usuarios', usuariosRouter);
app.use('/roles', rolesRouter);
app.use('/planes', planesRouter);
app.use('/membresias', membresiasRouter);
app.use('/asistencias', asistenciasRouter);
app.use('/entrenadores', entrenadoresRouter);
app.use('/pagos', pagosRouter);
app.use('/cierres', cierresRouter);
app.use('/categorias-gasto', categoriasGastoRouter);
app.use('/gastos', gastosRouter);
app.use('/estadisticas', estadisticasRouter);

// Manejador de errores de subida de archivos. Express reconoce un
// manejador de errores porque tiene CUATRO parámetros, y debe ir DESPUÉS
// de todas las rutas. Convierte los rechazos de Multer (tipo no permitido,
// archivo demasiado grande) en respuestas 400 con un mensaje claro
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ErrorDeSubida) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const mensaje =
      err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el tamaño máximo de 5 MB' : 'Error al procesar el archivo';
    return res.status(400).json({ error: mensaje });
  }
  // Cualquier otro error sigue su camino normal
  next(err);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});