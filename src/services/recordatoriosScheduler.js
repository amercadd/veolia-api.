const { revisarRecordatorios } = require('./recordatorios');

let ultimaRevisionDia = null;

function fechaHoyStr() {
  return new Date().toISOString().slice(0, 10);
}

// Se puede llamar tantas veces como se quiera (por el setInterval del
// servidor, o de forma oportunista desde una petición real) — solo ejecuta
// la revisión real una vez por día calendario.
async function revisarRecordatoriosSiNuevoDia() {
  const hoy = fechaHoyStr();
  if (ultimaRevisionDia === hoy) return;
  ultimaRevisionDia = hoy;
  try {
    await revisarRecordatorios();
  } catch (err) {
    console.error('Error revisando recordatorios:', err.message);
  }
}

module.exports = { revisarRecordatoriosSiNuevoDia };
