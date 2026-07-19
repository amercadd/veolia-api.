-- CreateTable
CREATE TABLE "FacturaVeolia" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "numeroFactura" TEXT,
    "referenciaPago" TEXT,
    "fechaEmision" TIMESTAMP(3),
    "periodoFacturado" TEXT,
    "fechaMaximaPago" TIMESTAMP(3),
    "fechaSuspension" TIMESTAMP(3),
    "valorAcueducto" DECIMAL(65,30),
    "valorAseo" DECIMAL(65,30),
    "totalPagar" DECIMAL(65,30),
    "consumoM3" DECIMAL(65,30),
    "historico" JSONB,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaVeolia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacturaVeolia_cuentaId_key" ON "FacturaVeolia"("cuentaId");

-- AddForeignKey
ALTER TABLE "FacturaVeolia" ADD CONSTRAINT "FacturaVeolia_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
