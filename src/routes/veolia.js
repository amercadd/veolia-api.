const router = require('express').Router();
const prisma = require('../db');
const { ApiError } = require('../middleware/errorHandler');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { obtenerFacturaVeolia } = require('../services/veolia');

router.use(requireAuth);

// Valida un número de suscriptor de Veolia Sabana y trae su factura vigente,
// antes de que el cliente termine de agregar el servicio de Agua.
router.post('/factura', requireVerified, async (req, res, next) => {
  try {
    const { numeroSuscriptor } = req.body;
    if (!numeroSuscriptor) throw new ApiError(400, 'El número de suscriptor es obligatorio');

    // El mismo usuario no puede tener el mismo suscriptor de agua duplicado,
    // sin importar en cuál de sus hogares ya lo haya registrado.
    const yaRegistrado = await prisma.cuentaServicio.findFirst({
      where: {
        tipo: 'AGUA',
        numeroCuenta: numeroSuscriptor,
        hogar: { miembros: { some: { usuarioId: req.usuario.id } } },
      },
    });
    if (yaRegistrado) {
      throw new ApiError(409, 'Ya tienes registrado ese servicio de agua (suscriptor ' + numeroSuscriptor + ').');
    }

    const { buffer, ...datos } = await obtenerFacturaVeolia(numeroSuscriptor);
    res.json({ ...datos, pdfBase64: buffer.toString('base64') });
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(404, err.message));
  }
});

module.exports = router;
