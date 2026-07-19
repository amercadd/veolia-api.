const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const prisma = require('../db');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Token no proporcionado');
    }
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario) throw new ApiError(401, 'Usuario no encontrado');
    req.usuario = usuario;
    next();
  } catch (err) {
    next(new ApiError(401, 'Token inválido o expirado'));
  }
}

// Regla de negocio: no se puede pagar ni crear hogares sin verificar correo y celular
function requireVerified(req, res, next) {
  const { correoVerificado, celularVerificado } = req.usuario;
  if (!correoVerificado || !celularVerificado) {
    return next(new ApiError(403, 'Debes verificar tu correo y celular antes de continuar'));
  }
  next();
}

module.exports = { requireAuth, requireVerified };
