const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { ApiError } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { enviarCodigoCorreo, enviarCodigoRecuperacion } = require('../services/email');
const { enviarCodigoSms } = require('../services/sms');
const { limiteEnvioCodigo, limiteOlvidePassword, limiteVerificacion, limiteLogin } = require('../middleware/rateLimit');

// En producción, los códigos se guardan en una tabla separada con expiración
// y se envían por proveedor de correo/SMS real. Aquí se simula en memoria.
const codigosVerificacion = new Map(); // key: `${usuarioId}:correo|celular` -> codigo

function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/registro', limiteEnvioCodigo, async (req, res, next) => {
  try {
    const { nombre, correo, celular, password, tipoDocumento, numeroDocumento } = req.body;
    if (!nombre || !correo || !celular || !password || !tipoDocumento || !numeroDocumento) {
      throw new ApiError(400, 'Todos los campos son obligatorios');
    }
    if (password.length < 8) {
      throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
    }

    const existente = await prisma.usuario.findFirst({
      where: { OR: [{ correo }, { celular }] },
    });
    if (existente) {
      const campo = existente.correo === correo ? 'correo' : 'celular';
      throw new ApiError(409, `Ya existe una cuenta con ese ${campo}. Intenta iniciar sesión o usa "¿Olvidaste tu contraseña?".`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, correo, celular, tipoDocumento, numeroDocumento, passwordHash },
    });

    const codigoCorreo = generarCodigo();
    const codigoCelular = generarCodigo();
    codigosVerificacion.set(`${usuario.id}:correo`, codigoCorreo);
    codigosVerificacion.set(`${usuario.id}:celular`, codigoCelular);

    try {
      await enviarCodigoCorreo(correo, codigoCorreo);
    } catch (err) {
      console.error(`No se pudo enviar el correo de verificación a ${correo}:`, err.message);
    }
    try {
      await enviarCodigoSms(celular, codigoCelular);
    } catch (err) {
      console.error(`No se pudo enviar el SMS de verificación a ${celular}:`, err.message);
    }

    res.status(201).json({ usuarioId: usuario.id, mensaje: 'Revisa tu correo y celular para verificar tu cuenta' });
  } catch (err) {
    next(err);
  }
});

router.post('/verificar-correo', limiteVerificacion, async (req, res, next) => {
  try {
    const { usuarioId, codigo } = req.body;
    const codigoEsperado = codigosVerificacion.get(`${usuarioId}:correo`);
    if (!codigoEsperado || codigoEsperado !== codigo) {
      throw new ApiError(400, 'Código inválido o expirado');
    }
    await prisma.usuario.update({ where: { id: usuarioId }, data: { correoVerificado: true } });
    codigosVerificacion.delete(`${usuarioId}:correo`);
    res.json({ mensaje: 'Correo verificado' });
  } catch (err) {
    next(err);
  }
});

router.post('/verificar-celular', limiteVerificacion, async (req, res, next) => {
  try {
    const { usuarioId, codigo } = req.body;
    const codigoEsperado = codigosVerificacion.get(`${usuarioId}:celular`);
    if (!codigoEsperado || codigoEsperado !== codigo) {
      throw new ApiError(400, 'Código inválido o expirado');
    }
    await prisma.usuario.update({ where: { id: usuarioId }, data: { celularVerificado: true } });
    codigosVerificacion.delete(`${usuarioId}:celular`);
    res.json({ mensaje: 'Celular verificado' });
  } catch (err) {
    next(err);
  }
});

router.post('/reenviar-codigo', limiteEnvioCodigo, async (req, res, next) => {
  try {
    const { usuarioId, canal } = req.body; // canal: 'correo' | 'celular'
    if (!['correo', 'celular'].includes(canal)) throw new ApiError(400, 'Canal inválido');
    const codigo = generarCodigo();
    codigosVerificacion.set(`${usuarioId}:${canal}`, codigo);

    if (canal === 'correo') {
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      if (usuario) {
        try {
          await enviarCodigoCorreo(usuario.correo, codigo);
        } catch (err) {
          console.error(`No se pudo enviar el correo de verificación a ${usuario.correo}:`, err.message);
        }
      }
    } else {
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      if (usuario) {
        try {
          await enviarCodigoSms(usuario.celular, codigo);
        } catch (err) {
          console.error(`No se pudo enviar el SMS de verificación a ${usuario.celular}:`, err.message);
        }
      }
    }
    res.json({ mensaje: `Código reenviado por ${canal}` });
  } catch (err) {
    next(err);
  }
});

router.post('/olvide-password', limiteOlvidePassword, async (req, res, next) => {
  try {
    const { correo } = req.body;
    if (!correo) throw new ApiError(400, 'El correo es obligatorio');

    const usuario = await prisma.usuario.findUnique({ where: { correo } });
    if (usuario) {
      const codigo = generarCodigo();
      codigosVerificacion.set(`${usuario.id}:reset`, codigo);
      try {
        await enviarCodigoRecuperacion(usuario.correo, codigo);
      } catch (err) {
        console.error(`No se pudo enviar el correo de recuperación a ${usuario.correo}:`, err.message);
      }
    }
    // Respuesta genérica: no revela si el correo existe o no
    res.json({ mensaje: 'Si el correo está registrado, te enviamos un código para restablecer tu contraseña' });
  } catch (err) {
    next(err);
  }
});

router.post('/restablecer-password', limiteVerificacion, async (req, res, next) => {
  try {
    const { correo, codigo, passwordNueva } = req.body;
    if (!correo || !codigo || !passwordNueva) {
      throw new ApiError(400, 'Todos los campos son obligatorios');
    }
    if (passwordNueva.length < 8) {
      throw new ApiError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
    }
    const usuario = await prisma.usuario.findUnique({ where: { correo } });
    const codigoEsperado = usuario && codigosVerificacion.get(`${usuario.id}:reset`);
    if (!usuario || !codigoEsperado || codigoEsperado !== codigo) {
      throw new ApiError(400, 'Código inválido o expirado');
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash } });
    codigosVerificacion.delete(`${usuario.id}:reset`);
    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
});

router.post('/login', limiteLogin, async (req, res, next) => {
  try {
    const { correo, password } = req.body;
    const usuario = await prisma.usuario.findUnique({ where: { correo } });
    if (!usuario) throw new ApiError(401, 'Credenciales inválidas');

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) throw new ApiError(401, 'Credenciales inválidas');

    const token = jwt.sign({ sub: usuario.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correoVerificado: usuario.correoVerificado,
        celularVerificado: usuario.celularVerificado,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const { id, nombre, correo, correoVerificado, celular, celularVerificado, tipoDocumento, numeroDocumento } = req.usuario;
  res.json({ id, nombre, correo, correoVerificado, celular, celularVerificado, tipoDocumento, numeroDocumento });
});

router.post('/cambiar-password', requireAuth, async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    if (!passwordActual || !passwordNueva) {
      throw new ApiError(400, 'Todos los campos son obligatorios');
    }
    if (passwordNueva.length < 8) {
      throw new ApiError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
    }
    const passwordValida = await bcrypt.compare(passwordActual, req.usuario.passwordHash);
    if (!passwordValida) throw new ApiError(401, 'La contraseña actual no es correcta');

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    await prisma.usuario.update({ where: { id: req.usuario.id }, data: { passwordHash } });
    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
