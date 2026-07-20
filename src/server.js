const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const hogaresRoutes = require('./routes/hogares');
const cuentasRoutes = require('./routes/cuentas');
const veoliaRoutes = require('./routes/veolia');
const pushRoutes = require('./routes/push');
const { errorHandler } = require('./middleware/errorHandler');
const { revisarRecordatoriosSiNuevoDia } = require('./services/recordatoriosScheduler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/hogares', hogaresRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api/veolia', veoliaRoutes);
app.use('/api/push', pushRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API corriendo en puerto ${PORT}`));

// Revisa recordatorios una vez al arrancar y luego cada 6 horas mientras el
// proceso siga vivo (en el free tier de Render el servidor puede dormirse
// por inactividad, así que también se dispara de forma oportunista desde
// una petición real; ver services/recordatoriosScheduler.js).
revisarRecordatoriosSiNuevoDia();
setInterval(revisarRecordatoriosSiNuevoDia, 6 * 60 * 60 * 1000);

module.exports = app;
