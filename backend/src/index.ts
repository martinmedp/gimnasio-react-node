import express from 'express';
import cors from 'cors';
import path from 'path';
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

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});