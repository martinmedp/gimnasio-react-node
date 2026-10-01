import { Prisma } from '@prisma/client';

// Debe coincidir EXACTAMENTE con el valor que usa el formulario de pagos
// del frontend (MembresiaPage): "efectivo", en minúsculas
export const METODO_EFECTIVO = 'efectivo';

// Lo mínimo que necesitamos de un pago para poder sumarlo
type PagoBasico = { monto: Prisma.Decimal; metodoPago: string };

// Calcula totales a partir de una lista de pagos: total general, total en
// efectivo y un desglose por método de pago.
//
// Usamos Prisma.Decimal (aritmética decimal exacta) y no Number, porque
// con dinero los números normales de JavaScript pueden acumular errores de
// redondeo (0.1 + 0.2 = 0.30000000000000004). Los Decimal se convierten
// solos a texto al enviarlos con res.json(), por eso el frontend los
// recibe como string, igual que ya pasa con el precio de los planes.
export function resumirPagos(pagos: PagoBasico[]) {
  const porMetodo = new Map<string, { total: Prisma.Decimal; cantidad: number }>();
  let totalGeneral = new Prisma.Decimal(0);

  for (const pago of pagos) {
    totalGeneral = totalGeneral.plus(pago.monto);

    const actual = porMetodo.get(pago.metodoPago) ?? { total: new Prisma.Decimal(0), cantidad: 0 };
    porMetodo.set(pago.metodoPago, {
      total: actual.total.plus(pago.monto),
      cantidad: actual.cantidad + 1,
    });
  }

  return {
    totalGeneral,
    totalEfectivo: porMetodo.get(METODO_EFECTIVO)?.total ?? new Prisma.Decimal(0),
    cantidad: pagos.length,
    // De Map a arreglo, que es lo que se puede enviar como JSON
    porMetodo: Array.from(porMetodo, ([metodoPago, datos]) => ({ metodoPago, ...datos })),
  };
}