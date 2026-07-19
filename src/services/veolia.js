const { PDFParse } = require('pdf-parse');

const SABANA_URL = 'https://oficinavirtual.veolia.co/DEE/SabanaContrato';

const SIN_DATOS = 'No existen datos para ese número de suscriptor. Verifica el número (parte superior derecha del recibo) e inténtalo de nuevo.';

// Consulta la oficina virtual de Veolia Sabana con el número de suscriptor y
// descarga el PDF de la factura vigente. Es el mismo flujo que sigue un
// usuario en el formulario web: primero se busca el contrato, la respuesta
// trae un formulario que se autoenvía hacia la URL real del PDF.
async function obtenerFacturaVeolia(numeroSuscriptor) {
  const lookupRes = await fetch(SABANA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `id=${encodeURIComponent(numeroSuscriptor)}&obtener_datos=Obtener+Factura`,
  });
  const html = await lookupRes.text();
  // Cuando el suscriptor no existe, Veolia arma el mismo formulario pero con
  // id_fac vacío (ej. "...DuplicadoFactura.php?id_loc=70&id_fac="), en vez de un número.
  const match = html.match(/action="([^"]+DuplicadoFactura\.php\?id_loc=\d+&id_fac=(\d*))"/);
  if (!match || !match[2]) {
    throw new Error(SIN_DATOS);
  }

  const pdfRes = await fetch(match[1], { method: 'POST' });
  if (!pdfRes.ok) {
    throw new Error('No se pudo descargar el PDF de la factura');
  }
  let buffer = Buffer.from(await pdfRes.arrayBuffer());
  const pdfStart = buffer.indexOf('%PDF-');
  if (pdfStart < 0) {
    // No llegó un PDF: es el mensaje de texto plano de "no existen datos" u otro error.
    const texto = buffer.toString('utf8').replace(/^﻿/, '').trim();
    throw new Error(texto.startsWith('No existen datos') ? SIN_DATOS : texto || SIN_DATOS);
  }
  if (pdfStart > 0) buffer = buffer.subarray(pdfStart);

  const datos = { totalPagar: null, fechaMaximaPago: null };
  try {
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    Object.assign(datos, extraerDatosFactura(text));
  } catch {
    // Si falla el parseo de texto, igual se devuelve el PDF con los datos que se hayan podido leer.
  }

  return { buffer, ...datos };
}

// Convierte "51.386,31" (formato colombiano) a 51386.31
function parseMonto(str) {
  if (!str) return null;
  const n = Number(str.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function extraerDatosFactura(text) {
  const datos = {};

  const totalMatch = text.match(/Valor Acueducto y Alcantarillado\s*([\d.,]+)\s*Valor Aseo\s*([\d.,]*)\s*Total\s*([\d.,]+)/);
  if (totalMatch) {
    datos.valorAcueducto = parseMonto(totalMatch[1]);
    datos.valorAseo = parseMonto(totalMatch[2]);
    datos.totalPagar = parseMonto(totalMatch[3]);
  }

  const docMatch = text.match(/No Documento Equivalente:\s*Suscriptor:\s*([A-Z0-9]+)\s*(\d+)/);
  if (docMatch) datos.numeroDocumento = docMatch[1];

  const facturaMatch = text.match(/No\.\s+(\d{5,})/);
  if (facturaMatch) datos.numeroFactura = facturaMatch[1];

  const referenciaMatch = text.match(/Referencia de pago\s*(\d+)/);
  if (referenciaMatch) datos.referenciaPago = referenciaMatch[1];

  const emisionMatch = text.match(/Fecha Emisión\s*(\d{4}-\d{2}-\d{2})/);
  if (emisionMatch) datos.fechaEmision = emisionMatch[1];

  const periodoMatch = text.match(/Periodo Facturado\s*(\d{4}\/\S+)/);
  if (periodoMatch) datos.periodoFacturado = periodoMatch[1];

  const fechaMaximaMatch = text.match(/Fecha Máxima de pago\s*(\d{4}-\d{2}-\d{2})/);
  if (fechaMaximaMatch) datos.fechaMaximaPago = fechaMaximaMatch[1];

  const suspensionMatch = text.match(/Se suspende a partir de\s*(\d{4}-\d{2}-\d{2})/);
  if (suspensionMatch) datos.fechaSuspension = suspensionMatch[1];

  const consumoMatch = text.match(/\bConsumo\s*->\s*(\d+(?:\.\d+)?)/);
  if (consumoMatch) datos.consumoM3 = Number(consumoMatch[1]);

  // Histórico de facturación: una línea con 6-7 periodos "YYYYMM" seguida de
  // una línea con los valores "$14,150 $20,275 ..." de cada uno de esos meses.
  const historicoMatch = text.match(/((?:\d{6}\s+){2,}\d{6})\s*\n\s*((?:\$[\d,]+\s*){2,}\$[\d,]+)/);
  if (historicoMatch) {
    const periodos = historicoMatch[1].trim().split(/\s+/);
    const valores = historicoMatch[2].trim().split(/\s+/).map(v => Number(v.replace(/[$,]/g, '')));
    datos.historico = periodos.map((p, i) => ({
      mes: `${p.slice(0, 4)}-${p.slice(4, 6)}`,
      valor: valores[i],
    }));
  }

  return datos;
}

module.exports = { obtenerFacturaVeolia };
