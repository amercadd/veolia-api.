# API de pago de servicios públicos

## Instalación

```bash
npm install
cp .env.example .env   # y edita DATABASE_URL y JWT_SECRET
npx prisma migrate dev --name init
npm run dev
```

## Endpoints

### Auth
- `POST /api/auth/registro` — crea usuario, envía códigos de verificación
- `POST /api/auth/verificar-correo` — { usuarioId, codigo }
- `POST /api/auth/verificar-celular` — { usuarioId, codigo }
- `POST /api/auth/reenviar-codigo` — { usuarioId, canal }
- `POST /api/auth/login` — { correo, password } → token JWT
- `GET /api/auth/me` — perfil del usuario autenticado

### Hogares
- `POST /api/hogares` — crear hogar (requiere verificación)
- `GET /api/hogares` — listar hogares del usuario
- `GET /api/hogares/:id` — detalle con miembros y cuentas
- `POST /api/hogares/:id/miembros` — invitar miembro (solo dueño)
- `DELETE /api/hogares/:id/miembros/:usuarioId` — remover miembro (solo dueño)
- `POST /api/hogares/:id/transferir-dueno` — transferir propiedad
- `DELETE /api/hogares/:id` — eliminar hogar (solo dueño)

### Cuentas de servicio
- `POST /api/cuentas/hogares/:hogarId` — crear cuenta (permite varias del mismo tipo)
- `GET /api/cuentas/hogares/:hogarId?tipo=INTERNET` — listar, con filtro opcional
- `PATCH /api/cuentas/:id` — editar alias / pago automático
- `DELETE /api/cuentas/:id` — eliminar (solo dueño)

### Pagos
- `POST /api/pagos` — registrar pago (valida periodo no duplicado)
- `GET /api/pagos/cuenta/:cuentaId` — historial de una cuenta
- `GET /api/pagos/hogares/:hogarId/resumen-mensual` — datos para el gráfico mes a mes

### Métodos de pago
- `POST /api/metodos-pago`
- `GET /api/metodos-pago`
- `PATCH /api/metodos-pago/:id/predeterminado`
- `DELETE /api/metodos-pago/:id` — bloqueado si tiene pago automático activo asociado

## Notas
- Los códigos de verificación y la integración con pasarela de pago (PSE/Wompi/Stripe)
  están marcados con `TODO` — hay que conectarlos a proveedores reales antes de producción.
- Todas las rutas protegidas requieren header `Authorization: Bearer <token>`.
