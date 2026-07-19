const rateLimit = require('express-rate-limit');

function crearLimitador(maxIntentos, minutos) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    max: maxIntentos,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' },
  });
}

// Envían SMS/correo reales (tienen costo o pueden usarse para spamear a un tercero)
const limiteEnvioCodigo = crearLimitador(5, 15);
const limiteOlvidePassword = crearLimitador(5, 15);
// Permiten adivinar un código de 6 dígitos o una contraseña
const limiteVerificacion = crearLimitador(10, 15);
const limiteLogin = crearLimitador(10, 15);

module.exports = { limiteEnvioCodigo, limiteOlvidePassword, limiteVerificacion, limiteLogin };
