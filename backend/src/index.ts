import express from 'express';
import cors from 'cors';
import path from 'path';
import clientesRouter from './routes/clientes';
import authRouter from './routes/auth';
import medidasRouter from './routes/medidas';
import ejerciciosRouter from './routes/ejercicios';
import seccionesCuerpoRouter from './routes/seccionesCuerpo';
import rutinasRouter from './routes/rutinas';

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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});