const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const hogaresRoutes = require('./routes/hogares');
const cuentasRoutes = require('./routes/cuentas');
const veoliaRoutes = require('./routes/veolia');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/hogares', hogaresRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api/veolia', veoliaRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API corriendo en puerto ${PORT}`));

module.exports = app;
