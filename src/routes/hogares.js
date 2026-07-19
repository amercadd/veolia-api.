const router = require('express').Router();
const prisma = require('../db');
const { ApiError } = require('../middleware/errorHandler');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { enviarInvitacionHogar } = require('../services/email');
const { enviarInvitacionHogarSms } = require('../services/sms');
const { limiteEnvioCodigo } = require('../middleware/rateLimit');

// Acepta un correo o un número de celular en un solo campo y dice cuál es.
function detectarContacto(valor) {
  const texto = (valor || '').trim();
  if (texto.includes('@')) return { correo: texto.toLowerCase(), celular: null };
  return { correo: null, celular: texto.replace(/\D/g, '') };
}

async function rolDeUsuarioEnHogar(hogarId, usuarioId) {
  const miembro = await prisma.miembroHogar.findUnique({
    where: { hogarId_usuarioId: { hogarId, usuarioId } },
  });
  return miembro?.rol || null;
}

router.use(requireAuth);

router.post('/', requireVerified, async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre) throw new ApiError(400, 'El nombre del hogar es obligatorio');

    const hogar = await prisma.hogar.create({
      data: {
        nombre,
        creadoPor: req.usuario.id,
        miembros: { create: { usuarioId: req.usuario.id, rol: 'DUENO' } },
      },
      include: { miembros: true },
    });
    res.status(201).json(hogar);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const hogares = await prisma.hogar.findMany({
      where: { miembros: { some: { usuarioId: req.usuario.id } } },
      include: { miembros: true },
    });
    res.json(hogares);
  } catch (err) {
    next(err);
  }
});

// Mis invitaciones pendientes (buscadas por mi propio correo o celular, sin
// importar si ya tenía cuenta cuando me invitaron o me registré después).
router.get('/invitaciones', async (req, res, next) => {
  try {
    const invitaciones = await prisma.invitacionHogar.findMany({
      where: {
        estado: 'PENDIENTE',
        OR: [{ correo: req.usuario.correo }, { celular: req.usuario.celular }],
      },
      include: { hogar: true },
      orderBy: { creadaEn: 'desc' },
    });
    res.json(invitaciones);
  } catch (err) {
    next(err);
  }
});

router.post('/invitaciones/:invId/aceptar', async (req, res, next) => {
  try {
    const invitacion = await prisma.invitacionHogar.findUnique({ where: { id: req.params.invId } });
    if (!invitacion || invitacion.estado !== 'PENDIENTE') throw new ApiError(404, 'Invitación no encontrada');
    const esMia = invitacion.correo === req.usuario.correo || invitacion.celular === req.usuario.celular;
    if (!esMia) throw new ApiError(403, 'Esta invitación no es tuya');

    await prisma.$transaction([
      prisma.miembroHogar.create({
        data: { hogarId: invitacion.hogarId, usuarioId: req.usuario.id, rol: 'PUEDE_PAGAR' },
      }),
      prisma.invitacionHogar.delete({ where: { id: invitacion.id } }),
    ]);
    res.json({ mensaje: 'Te uniste al hogar' });
  } catch (err) {
    next(err);
  }
});

router.post('/invitaciones/:invId/rechazar', async (req, res, next) => {
  try {
    const invitacion = await prisma.invitacionHogar.findUnique({ where: { id: req.params.invId } });
    if (!invitacion || invitacion.estado !== 'PENDIENTE') throw new ApiError(404, 'Invitación no encontrada');
    const esMia = invitacion.correo === req.usuario.correo || invitacion.celular === req.usuario.celular;
    if (!esMia) throw new ApiError(403, 'Esta invitación no es tuya');

    await prisma.invitacionHogar.delete({ where: { id: invitacion.id } });
    res.json({ mensaje: 'Invitación rechazada' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rol = await rolDeUsuarioEnHogar(req.params.id, req.usuario.id);
    if (!rol) throw new ApiError(403, 'No perteneces a este hogar');

    const hogar = await prisma.hogar.findUnique({
      where: { id: req.params.id },
      include: {
        miembros: { include: { usuario: true } },
        cuentasServicio: true,
        invitaciones: { where: { estado: 'PENDIENTE' } },
      },
    });
    res.json(hogar);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const rol = await rolDeUsuarioEnHogar(req.params.id, req.usuario.id);
    if (rol !== 'DUENO') throw new ApiError(403, 'Solo el dueño puede renombrar el hogar');

    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) throw new ApiError(400, 'El nombre del hogar es obligatorio');

    const hogar = await prisma.hogar.update({
      where: { id: req.params.id },
      data: { nombre: nombre.trim() },
    });
    res.json(hogar);
  } catch (err) {
    next(err);
  }
});

// Invita por correo o celular: si la persona ya tiene cuenta le llega la
// invitación para aceptar; si no, le llega un mensaje con el link de la app
// para que se registre con ese mismo correo/celular y ahí vea la invitación.
router.post('/:id/invitaciones', requireVerified, limiteEnvioCodigo, async (req, res, next) => {
  try {
    const rol = await rolDeUsuarioEnHogar(req.params.id, req.usuario.id);
    if (rol !== 'DUENO') throw new ApiError(403, 'Solo el dueño puede invitar miembros');

    const { contacto } = req.body;
    if (!contacto) throw new ApiError(400, 'Ingresa un correo o número de celular');
    const { correo, celular } = detectarContacto(contacto);
    if (celular && celular.length < 7) throw new ApiError(400, 'Número de celular inválido');

    const hogar = await prisma.hogar.findUnique({ where: { id: req.params.id } });

    const usuarioExistente = await prisma.usuario.findFirst({
      where: correo ? { correo } : { celular },
    });
    if (usuarioExistente) {
      const yaEsMiembro = await rolDeUsuarioEnHogar(req.params.id, usuarioExistente.id);
      if (yaEsMiembro) throw new ApiError(409, 'Esa persona ya es miembro de este hogar');
    }

    const yaInvitado = await prisma.invitacionHogar.findFirst({
      where: { hogarId: req.params.id, estado: 'PENDIENTE', ...(correo ? { correo } : { celular }) },
    });
    if (yaInvitado) throw new ApiError(409, 'Ya hay una invitación pendiente para ese contacto');

    const invitacion = await prisma.invitacionHogar.create({
      data: { hogarId: req.params.id, correo, celular },
    });

    const existeCuenta = !!usuarioExistente;
    try {
      if (correo) await enviarInvitacionHogar(correo, hogar.nombre, existeCuenta);
      else await enviarInvitacionHogarSms(celular, hogar.nombre, existeCuenta);
    } catch (err) {
      console.error(`No se pudo enviar la invitación a ${correo || celular}:`, err.message);
    }

    res.status(201).json({ ...invitacion, existeCuenta });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/invitaciones/:invId', async (req, res, next) => {
  try {
    const rol = await rolDeUsuarioEnHogar(req.params.id, req.usuario.id);
    if (rol !== 'DUENO') throw new ApiError(403, 'Solo el dueño puede cancelar invitaciones');

    await prisma.invitacionHogar.deleteMany({ where: { id: req.params.invId, hogarId: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/miembros/:usuarioId', async (req, res, next) => {
  try {
    const rol = await rolDeUsuarioEnHogar(req.params.id, req.usuario.id);
    if (rol !== 'DUENO') throw new ApiError(403, 'Solo el dueño puede remover miembros');
    if (req.params.usuarioId === req.usuario.id) {
      throw new ApiError(400, 'El dueño no puede removerse a sí mismo; transfiere el hogar primero');
    }

    await prisma.miembroHogar.delete({
      where: { hogarId_usuarioId: { hogarId: req.params.id, usuarioId: req.params.usuarioId } },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Regla: un hogar nunca queda sin dueño; transferir implica asignar otro dueño primero
router.post('/:id/transferir-dueno', async (req, res, next) => {
  try {
    const rolActual = await rolDeUsuarioEnHogar(req.params.id, req.usuario.id);
    if (rolActual !== 'DUENO') throw new ApiError(403, 'Solo el dueño puede transferir el hogar');

    const { nuevoDuenoId } = req.body;
    const nuevoMiembro = await rolDeUsuarioEnHogar(req.params.id, nuevoDuenoId);
    if (!nuevoMiembro) throw new ApiError(400, 'El nuevo dueño debe ser miembro del hogar');

    await prisma.$transaction([
      prisma.miembroHogar.update({
        where: { hogarId_usuarioId: { hogarId: req.params.id, usuarioId: req.usuario.id } },
        data: { rol: 'PUEDE_PAGAR' },
      }),
      prisma.miembroHogar.update({
        where: { hogarId_usuarioId: { hogarId: req.params.id, usuarioId: nuevoDuenoId } },
        data: { rol: 'DUENO' },
      }),
    ]);
    res.json({ mensaje: 'Hogar transferido' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const rol = await rolDeUsuarioEnHogar(req.params.id, req.usuario.id);
    if (rol !== 'DUENO') throw new ApiError(403, 'Solo el dueño puede eliminar el hogar');

    await prisma.hogar.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
