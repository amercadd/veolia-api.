const prisma = require('../db');

// Registrar un evento nunca debe tumbar el flujo principal (login, crear
// hogar, etc.) si por algo falla la escritura.
async function registrarEvento(usuarioId, tipo) {
  try {
    await prisma.eventoUso.create({ data: { usuarioId, tipo } });
  } catch (err) {
    console.error(`No se pudo registrar el evento ${tipo}:`, err.message);
  }
}

module.exports = { registrarEvento };
