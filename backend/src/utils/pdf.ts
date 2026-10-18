import PDFDocument from 'pdfkit';
import { Response } from 'express';

// Formatea dinero igual que en el frontend (utils/formato.ts), pero del
// lado del servidor — los PDF se generan en el backend, nunca tocan React
export function formatearDineroPdf(valor: number | string): string {
  const numero = Number(valor);
  const texto = Math.abs(numero).toLocaleString('es-CO');
  return numero < 0 ? `-$${texto}` : `$${texto}`;
}

export function formatearFechaPdf(fecha: Date | string): string {
  return new Date(fecha).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatearFechaHoraPdf(fecha: Date | string): string {
  return new Date(fecha).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Crea un documento nuevo y lo conecta directamente a la respuesta HTTP
// (res). PDFKit permite "stream-ear" el PDF mientras se genera, en vez de
// construirlo completo en memoria y enviarlo de una sola vez
export function crearPdf(res: Response, nombreArchivo: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);

  doc.pipe(res);
  return doc;
}

// Encabezado simple y reutilizable: un título grande y una línea divisoria debajo
export function dibujarEncabezado(doc: PDFKit.PDFDocument, titulo: string, subtitulo?: string) {
  doc.fontSize(18).font('Helvetica-Bold').text('Gimnasio', { align: 'left' });
  doc.fontSize(14).font('Helvetica').text(titulo, { align: 'left' });
  if (subtitulo) {
    doc.fontSize(10).fillColor('#555555').text(subtitulo);
    doc.fillColor('#000000');
  }
  doc.moveDown(0.5);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#cccccc')
    .stroke();
  doc.moveDown();
}

interface ColumnaTabla {
  titulo: string;
  ancho: number; // en puntos (~72 puntos = 1 pulgada)
  alinearDerecha?: boolean; // para columnas numéricas, como montos
}

// Dibuja una tabla simple: encabezado en negrita + filas de texto.
// PDFKit no trae tablas incorporadas, así que la dibujamos nosotros mismos,
// columna por columna. Si el contenido no cabe en la página actual, salta
// de página sola y repite el encabezado arriba
export function dibujarTabla(
  doc: PDFKit.PDFDocument,
  columnas: ColumnaTabla[],
  filas: string[][]
) {
  const alturaFila = 20;
  const xInicial = doc.page.margins.left;
  const yLimite = doc.page.height - doc.page.margins.bottom;

  function dibujarEncabezadoTabla() {
    let x = xInicial;
    const y = doc.y; // capturamos la posición UNA sola vez, antes del bucle
    doc.font('Helvetica-Bold').fontSize(9);
    columnas.forEach((columna) => {
      doc.text(columna.titulo, x, y, {
        width: columna.ancho,
        align: columna.alinearDerecha ? 'right' : 'left',
        lineBreak: false,
      });
      x += columna.ancho;
    });
    doc.moveDown(0.3);
    doc
      .moveTo(xInicial, doc.y)
      .lineTo(xInicial + columnas.reduce((suma, c) => suma + c.ancho, 0), doc.y)
      .strokeColor('#999999')
      .stroke();
    doc.moveDown(0.3);
  }

  dibujarEncabezadoTabla();
  doc.font('Helvetica').fontSize(8);

  filas.forEach((fila) => {
    if (doc.y + alturaFila > yLimite) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9);
      dibujarEncabezadoTabla();
      doc.font('Helvetica').fontSize(8);
    }

    const yFila = doc.y;
    let x = xInicial;
    fila.forEach((celda, i) => {
      doc.text(celda, x, yFila, {
        width: columnas[i].ancho,
        align: columnas[i].alinearDerecha ? 'right' : 'left',
      });
      x += columnas[i].ancho;
    });
    doc.y = yFila + alturaFila;
  });

  doc.moveDown();
}