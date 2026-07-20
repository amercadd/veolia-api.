const prisma = require('../db');
const { enviarPushAUsuario } = require('./push');

function diasHasta(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha);
  objetivo.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

// Revisa las suscripciones de agua con fecha máxima de pago conocida y le
// avisa (con una notificación push) a cada miembro del hogar cuyo recordatorio
// preferido (3 días, 1 día, el mismo día) coincida exactamente con los días
// que faltan. Pensado para correr una sola vez al día (ver server.js).
async function revisarRecordatorios() {
  const cuentas = await prisma.cuentaServicio.findMany({
    where: { tipo: 'AGUA', empresa: 'Veolia Sabana', facturaVeolia: { fechaMaximaPago: { not: null } } },
    include: {
      facturaVeolia: true,
      hogar: { include: { miembros: { include: { usuario: true } } } },
    },
  });

  for (const cuenta of cuentas) {
    const dias = diasHasta(cuenta.facturaVeolia.fechaMaximaPago);
    if (dias < 0 || dias > 3) continue;

    for (const miembro of cuenta.hogar.miembros) {
      if (miembro.usuario.reminderDias !== dias) continue;
      const mensaje = dias === 0
        ? `La factura de ${cuenta.empresa} (${cuenta.hogar.nombre}) vence hoy.`
        : `La factura de ${cuenta.empresa} (${cuenta.hogar.nombre}) vence en ${dias} día${dias === 1 ? '' : 's'}.`;
      try {
        await enviarPushAUsuario(miembro.usuario.id, {
          title: 'Veolia Sabana',
          body: mensaje,
        });
      } catch (err) {
        console.error(`No se pudo enviar recordatorio a ${miembro.usuario.id}:`, err.message);
      }
    }
  }
}

module.exports = { revisarRecordatorios };
