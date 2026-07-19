-- CreateEnum
CREATE TYPE "RolHogar" AS ENUM ('DUENO', 'PUEDE_PAGAR', 'SOLO_VER');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('LUZ', 'AGUA', 'GAS', 'INTERNET', 'CELULAR');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('EXITOSO', 'FALLIDO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "correoVerificado" BOOLEAN NOT NULL DEFAULT false,
    "celular" TEXT NOT NULL,
    "celularVerificado" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hogar" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hogar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroHogar" (
    "id" TEXT NOT NULL,
    "hogarId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" "RolHogar" NOT NULL DEFAULT 'PUEDE_PAGAR',

    CONSTRAINT "MiembroHogar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaServicio" (
    "id" TEXT NOT NULL,
    "hogarId" TEXT NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "empresa" TEXT NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "alias" TEXT,
    "pagoAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodoPago" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "predeterminado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "metodoPagoId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCorte" TIMESTAMP(3) NOT NULL,
    "referencia" TEXT NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'EXITOSO',

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_celular_key" ON "Usuario"("celular");

-- CreateIndex
CREATE UNIQUE INDEX "MiembroHogar_hogarId_usuarioId_key" ON "MiembroHogar"("hogarId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_referencia_key" ON "Pago"("referencia");

-- AddForeignKey
ALTER TABLE "Hogar" ADD CONSTRAINT "Hogar_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroHogar" ADD CONSTRAINT "MiembroHogar_hogarId_fkey" FOREIGN KEY ("hogarId") REFERENCES "Hogar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroHogar" ADD CONSTRAINT "MiembroHogar_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaServicio" ADD CONSTRAINT "CuentaServicio_hogarId_fkey" FOREIGN KEY ("hogarId") REFERENCES "Hogar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodoPago" ADD CONSTRAINT "MetodoPago_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
