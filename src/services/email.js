const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const VEOLIA_LOGO_URL = 'https://www.sabana.veolia.co/favicon.ico';

let logoBase64Cache = null;
async function obtenerLogoAdjunto() {
  if (!logoBase64Cache) {
    const res = await fetch(VEOLIA_LOGO_URL);
    const buffer = Buffer.from(await res.arrayBuffer());
    logoBase64Cache = buffer.toString('base64');
  }
  return {
    content: logoBase64Cache,
    filename: 'veolia-logo.png',
    contentType: 'image/png',
    contentId: 'veolia-logo',
  };
}

function plantillaCorreo(mensaje, codigo) {
  return `
    <div style="font-family:sans-serif;max-width:400px;margin:0 auto;text-align:center;">
      <img src="cid:veolia-logo" alt="Veolia Sabana" style="height:32px;margin-bottom:6px;">
      <div style="width:36px;height:3px;background:#ed1c24;margin:0 auto 20px;border-radius:999px;"></div>
      <p style="text-align:left;">${mensaje}</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${codigo}</p>
      <p style="text-align:left;color:#666;">Si no solicitaste esto, puedes ignorar este correo.</p>
    </div>`;
}

async function enviarCodigoCorreo(destinatario, codigo) {
  const { error } = await resend.emails.send({
    from: `Veolia Sabana <${process.env.RESEND_FROM}>`,
    to: destinatario,
    subject: 'Tu código de verificación - Veolia Sabana',
    html: plantillaCorreo('Tu código de verificación es:', codigo),
    attachments: [await obtenerLogoAdjunto()],
  });
  if (error) throw new Error(error.message || 'Resend rechazó el envío del correo');
}

async function enviarCodigoRecuperacion(destinatario, codigo) {
  const { error } = await resend.emails.send({
    from: `Veolia Sabana <${process.env.RESEND_FROM}>`,
    to: destinatario,
    subject: 'Recupera tu contraseña - Veolia Sabana',
    html: plantillaCorreo('Recibimos una solicitud para restablecer tu contraseña. Usa este código:', codigo),
    attachments: [await obtenerLogoAdjunto()],
  });
  if (error) throw new Error(error.message || 'Resend rechazó el envío del correo');
}

async function enviarInvitacionHogar(destinatario, nombreHogar, existeCuenta) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const mensaje = existeCuenta
    ? `Te invitaron a unirte al hogar <strong>${nombreHogar}</strong> en Veolia Sabana. Inicia sesión en la app para aceptar la invitación.`
    : `Te invitaron a unirte al hogar <strong>${nombreHogar}</strong> en Veolia Sabana. Aún no tienes cuenta: regístrate con este mismo correo en <a href="${appUrl}">${appUrl}</a> y ahí verás la invitación para aceptarla.`;
  const { error } = await resend.emails.send({
    from: `Veolia Sabana <${process.env.RESEND_FROM}>`,
    to: destinatario,
    subject: 'Te invitaron a un hogar - Veolia Sabana',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;text-align:center;">
        <img src="cid:veolia-logo" alt="Veolia Sabana" style="height:32px;margin-bottom:6px;">
        <div style="width:36px;height:3px;background:#ed1c24;margin:0 auto 20px;border-radius:999px;"></div>
        <p style="text-align:left;">${mensaje}</p>
      </div>`,
    attachments: [await obtenerLogoAdjunto()],
  });
  if (error) throw new Error(error.message || 'Resend rechazó el envío del correo');
}

module.exports = { enviarCodigoCorreo, enviarCodigoRecuperacion, enviarInvitacionHogar };
