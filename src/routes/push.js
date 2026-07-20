const router = require('express').Router();
const prisma = require('../db');
const { ApiError } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { registrarEvento } = require('../services/eventos');

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.use(requireAuth);

router.post('/subscribe', async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      throw new ApiError(400, 'Suscripción inválida');
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { usuarioId: req.usuario.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { usuarioId: req.usuario.id, p256dh: keys.p256dh, auth: keys.auth },
    });
    registrarEvento(req.usuario.id, 'PUSH_ACTIVADO');
    res.status(201).json({ mensaje: 'Notificaciones activadas' });
  } catch (err) {
    next(err);
  }
});

router.post('/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, usuarioId: req.usuario.id } });
    }
    res.json({ mensaje: 'Notificaciones desactivadas' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
