-- AlterTable
ALTER TABLE `pago` ADD COLUMN `cierreCajaId` INTEGER NULL;

-- CreateTable
CREATE TABLE `CierreCaja` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fechaDesde` DATETIME(3) NOT NULL,
    `fechaHasta` DATETIME(3) NOT NULL,
    `totalGeneral` DECIMAL(65, 30) NOT NULL,
    `totalEfectivo` DECIMAL(65, 30) NOT NULL,
    `efectivoContado` DECIMAL(65, 30) NOT NULL,
    `diferencia` DECIMAL(65, 30) NOT NULL,
    `observaciones` TEXT NULL,
    `fechaCierre` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cerradoPorId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Pago` ADD CONSTRAINT `Pago_cierreCajaId_fkey` FOREIGN KEY (`cierreCajaId`) REFERENCES `CierreCaja`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CierreCaja` ADD CONSTRAINT `CierreCaja_cerradoPorId_fkey` FOREIGN KEY (`cerradoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
