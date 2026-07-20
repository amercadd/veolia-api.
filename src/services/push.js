const webpush = require('web-push');
const prisma = require('../db');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Envía una notificación a todos los dispositivos donde el usuario haya
// aceptado recibir notificaciones. Si un endpoint ya no es válido (el
// usuario desinstaló la app o revocó el permiso), lo borramos.
async function enviarPushAUsuario(usuarioId, payload) {
  const suscripciones = await prisma.pushSubscription.findMany({ where: { usuarioId } });
  const cuerpo = JSON.stringify(payload);

  await Promise.all(suscripciones.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        cuerpo
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`No se pudo enviar push a ${usuarioId}:`, err.message);
      }
    }
  }));
}

module.exports = { enviarPushAUsuario };
