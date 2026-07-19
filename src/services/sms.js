const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

function aE164Colombia(celular) {
  const limpio = celular.replace(/\D/g, '');
  return limpio.startsWith('57') ? `+${limpio}` : `+57${limpio}`;
}

async function enviarCodigoSms(celular, codigo) {
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: aE164Colombia(celular),
    body: `Veolia Sabana: tu código de verificación es ${codigo}`,
  });
}

async function enviarInvitacionHogarSms(celular, nombreHogar, existeCuenta) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const mensaje = existeCuenta
    ? `Veolia Sabana: te invitaron al hogar "${nombreHogar}". Inicia sesión en la app para aceptar.`
    : `Veolia Sabana: te invitaron al hogar "${nombreHogar}". Regístrate con este número en ${appUrl} para ver la invitación.`;
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: aE164Colombia(celular),
    body: mensaje,
  });
}

module.exports = { enviarCodigoSms, enviarInvitacionHogarSms };
