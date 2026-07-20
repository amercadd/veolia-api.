const router = require('express').Router();
const prisma = require('../db');
const { ApiError } = require('../middleware/errorHandler');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { obtenerFacturaVeolia } = require('../services/veolia');

const TIPOS_VALIDOS = ['LUZ', 'AGUA', 'GAS', 'INTERNET', 'CELULAR'];

async function verificarAccesoHogar(hogarId, usuarioId, rolesPermitidos) {
  const miembro = await prisma.miembroHogar.findUnique({
    where: { hogarId_usuarioId: { hogarId, usuarioId } },
  });
  if (!miembro || !rolesPermitidos.includes(miembro.rol)) {
    throw new ApiError(403, 'No tienes permiso sobre este hogar');
  }
}

// Guarda (o actualiza) el snapshot completo de la última factura de Veolia
// consultada para una cuenta: fechas, referencia, valores e histórico.
async function guardarFacturaVeolia(cuentaId, datos) {
  const data = {
    numeroDocumento: datos.numeroDocumento || null,
    numeroFactura: datos.numeroFactura || null,
    referenciaPago: datos.referenciaPago || null,
    fechaEmision: datos.fechaEmision ? new Date(datos.fechaEmision) : null,
    periodoFacturado: datos.periodoFacturado || null,
    fechaMaximaPago: datos.fechaMaximaPago ? new Date(datos.fechaMaximaPago) : null,
    fechaSuspension: datos.fechaSuspension ? new Date(datos.fechaSuspension) : null,
    valorAcueducto: datos.valorAcueducto ?? null,
    valorAseo: datos.valorAseo ?? null,
    totalPagar: datos.totalPagar ?? null,
    consumoM3: datos.consumoM3 ?? null,
    historico: datos.historico || null,
  };
  await prisma.facturaVeolia.upsert({
    where: { cuentaId },
    create: { cuentaId, ...data },
    update: data,
  });
}

router.use(requireAuth);

// Crear una cuenta de servicio dentro de un hogar
router.post('/hogares/:hogarId', requireVerified, async (req, res, next) => {
  try {
    await verificarAccesoHogar(req.params.hogarId, req.usuario.id, ['DUENO', 'PUEDE_PAGAR']);

    const { tipo, empresa, numeroCuenta, alias, facturaVeolia } = req.body;
    if (!TIPOS_VALIDOS.includes(tipo)) throw new ApiError(400, 'Tipo de servicio inválido');
    if (!empresa || !numeroCuenta) throw new ApiError(400, 'Empresa y número de cuenta son obligatorios');

    // Si ya existe otra cuenta del mismo tipo en el hogar, se recomienda alias (no bloqueante)
    const cuenta = await prisma.cuentaServicio.create({
      data: { hogarId: req.params.hogarId, tipo, empresa, numeroCuenta, alias },
    });

    // Si venimos del flujo de Agua/Veolia Sabana, ya se consultó la factura
    // antes de crear la cuenta (para validar el suscriptor); guardamos ese snapshot.
    if (tipo === 'AGUA' && empresa === 'Veolia Sabana' && facturaVeolia) {
      await guardarFacturaVeolia(cuenta.id, facturaVeolia);
    }

    res.status(201).json(cuenta);
  } catch (err) {
    next(err);
  }
});

// Listar cuentas de un hogar (soporta filtro ?tipo=)
router.get('/hogares/:hogarId', async (req, res, next) => {
  try {
    await verificarAccesoHogar(req.params.hogarId, req.usuario.id, ['DUENO', 'PUEDE_PAGAR', 'SOLO_VER']);

    const { tipo } = req.query;
    const cuentas = await prisma.cuentaServicio.findMany({
      where: { hogarId: req.params.hogarId, ...(tipo ? { tipo } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { facturaVeolia: true },
    });
    res.json(cuentas);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireVerified, async (req, res, next) => {
  try {
    const cuenta = await prisma.cuentaServicio.findUnique({ where: { id: req.params.id } });
    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada');
    await verificarAccesoHogar(cuenta.hogarId, req.usuario.id, ['DUENO', 'PUEDE_PAGAR']);

    const { alias } = req.body;
    const actualizada = await prisma.cuentaServicio.update({
      where: { id: req.params.id },
      data: { alias },
    });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// Valor pendiente actual de una cuenta de Agua Veolia Sabana ya registrada
// (solo consulta, no bloquea por duplicado ya que la cuenta ya existe).
router.get('/:id/factura-veolia', async (req, res, next) => {
  try {
    const cuenta = await prisma.cuentaServicio.findUnique({ where: { id: req.params.id } });
    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada');
    await verificarAccesoHogar(cuenta.hogarId, req.usuario.id, ['DUENO', 'PUEDE_PAGAR', 'SOLO_VER']);
    if (cuenta.tipo !== 'AGUA' || cuenta.empresa !== 'Veolia Sabana') {
      throw new ApiError(400, 'Esta cuenta no es de acueducto Veolia Sabana');
    }

    const { buffer, ...datos } = await obtenerFacturaVeolia(cuenta.numeroCuenta);
    await guardarFacturaVeolia(cuenta.id, datos);
    res.json({ ...datos, pdfBase64: buffer.toString('base64') });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(502, err.message));
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const cuenta = await prisma.cuentaServicio.findUnique({ where: { id: req.params.id } });
    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada');
    await verificarAccesoHogar(cuenta.hogarId, req.usuario.id, ['DUENO']);

    await prisma.cuentaServicio.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
