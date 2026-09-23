import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken } from '../middleware/auth';

const router = Router();

// Función auxiliar: convierte un valor de texto (o vacío) a número o null.
// La reutilizamos varias veces abajo para no repetir la misma lógica de conversión
function aNumeroONull(valor: any): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const num = Number(valor);
  return isNaN(num) ? null : num;
}

// Calcula el IMC a partir del peso (kg) y la estatura (cm).
// Fórmula: peso / (estatura en metros)^2
// Devuelve null si falta alguno de los dos datos, ya que no se puede calcular
function calcularImc(pesoKg: number | null, estaturaCm: number | null): number | null {
  if (!pesoKg || !estaturaCm) return null;

  const estaturaM = estaturaCm / 100; // convertimos centímetros a metros
  const imc = pesoKg / (estaturaM * estaturaM);

  // Redondeamos a 1 decimal (ej. 24.3) para que se vea limpio en pantalla
  return Math.round(imc * 10) / 10;
}

// GET /medidas/cliente/:clienteId — trae el historial de medidas de un cliente,
// incluyendo el IMC calculado en cada registro (no se guarda en la BD, se calcula al vuelo)
router.get('/cliente/:clienteId', verificarToken, async (req, res) => {
  try {
    const { clienteId } = req.params;

    // Traemos también la estatura del cliente, ya que el IMC la necesita
    // y ese dato vive en la tabla Cliente, no en MedidaCorporal.
    // select trae solo este campo, más eficiente que traer todo el cliente completo
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(clienteId) },
      select: { estatura: true },
    });

    const medidas = await prisma.medidaCorporal.findMany({
      where: { clienteId: Number(clienteId) },
      orderBy: { fecha: 'desc' },
    });

    // .map() recorre cada medida y le agrega un campo nuevo "imc",
    // sin modificar los datos originales que vienen de la base de datos
    const medidasConImc = medidas.map((medida) => ({
      ...medida,
      imc: calcularImc(medida.peso, cliente?.estatura ?? null),
    }));

    res.json(medidasConImc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las medidas del cliente' });
  }
});

// POST /medidas — registra una nueva medición para un cliente
router.post('/', verificarToken, async (req, res) => {
  try {
    const {
      clienteId,
      peso,
      porcentajeGrasa,
      circunferenciaPecho,
      circunferenciaCintura,
      circunferenciaCadera,
      circunferenciaBrazo,
      circunferenciaMuslo,
      circunferenciaPantorrilla,
      circunferenciaCuello,
      notas,
    } = req.body;

    if (!clienteId) {
      return res.status(400).json({ error: 'El clienteId es obligatorio' });
    }

    const nuevaMedida = await prisma.medidaCorporal.create({
      data: {
        clienteId: Number(clienteId),
        peso: aNumeroONull(peso),
        porcentajeGrasa: aNumeroONull(porcentajeGrasa),
        circunferenciaPecho: aNumeroONull(circunferenciaPecho),
        circunferenciaCintura: aNumeroONull(circunferenciaCintura),
        circunferenciaCadera: aNumeroONull(circunferenciaCadera),
        circunferenciaBrazo: aNumeroONull(circunferenciaBrazo),
        circunferenciaMuslo: aNumeroONull(circunferenciaMuslo),
        circunferenciaPantorrilla: aNumeroONull(circunferenciaPantorrilla),
        circunferenciaCuello: aNumeroONull(circunferenciaCuello),
        notas: notas || null,
      },
    });

    res.status(201).json(nuevaMedida);
  } catch (error: any) {
    // P2003 significaría que el clienteId enviado no existe en la tabla Cliente
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'El cliente indicado no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la medida' });
  }
});

// DELETE /medidas/:id — elimina un registro de medida (ej. si se capturó por error)
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.medidaCorporal.delete({
      where: { id: Number(id) },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Medida no encontrada' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la medida' });
  }
});

export default router;