import { Router } from 'express';
import prisma from '../prisma';
import { verificarToken, verificarRol, verificarPropioCliente } from '../middleware/auth';

const router = Router();

function aNumeroONull(valor: any): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const num = Number(valor);
  return isNaN(num) ? null : num;
}

function calcularImc(pesoKg: number | null, estaturaCm: number | null): number | null {
  if (!pesoKg || !estaturaCm) return null;
  const estaturaM = estaturaCm / 100;
  const imc = pesoKg / (estaturaM * estaturaM);
  return Math.round(imc * 10) / 10;
}

// GET /medidas/cliente/:clienteId — según la matriz, Recepcionista NO
// gestiona medidas (no es su función); Administrador y Entrenador sí,
// y un Cliente puede ver únicamente las suyas
router.get(
  '/cliente/:clienteId',
  verificarToken,
  verificarRol('Administrador', 'Entrenador', 'Cliente'),
  verificarPropioCliente((req) => Number(req.params.clienteId)),
  async (req, res) => {
    try {
      const { clienteId } = req.params;

      const cliente = await prisma.cliente.findUnique({
        where: { id: Number(clienteId) },
        select: { estatura: true },
      });

      const medidas = await prisma.medidaCorporal.findMany({
        where: { clienteId: Number(clienteId) },
        orderBy: { fecha: 'desc' },
      });

      const medidasConImc = medidas.map((medida) => ({
        ...medida,
        imc: calcularImc(medida.peso, cliente?.estatura ?? null),
      }));

      res.json(medidasConImc);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener las medidas del cliente' });
    }
  }
);

// POST /medidas — registrar una medición: Administrador y Entrenador
router.post('/', verificarToken, verificarRol('Administrador', 'Entrenador'), async (req, res) => {
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
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'El cliente indicado no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la medida' });
  }
});

// DELETE /medidas/:id — mismo criterio que crear: Administrador y Entrenador
router.delete('/:id', verificarToken, verificarRol('Administrador', 'Entrenador'), async (req, res) => {
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