-- AlterTable
ALTER TABLE `pago` ADD COLUMN `anulado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `anuladoEn` DATETIME(3) NULL,
    ADD COLUMN `anuladoPorId` INTEGER NULL,
    ADD COLUMN `motivoAnulacion` TEXT NULL,
    ADD COLUMN `usuarioId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Pago` ADD CONSTRAINT `Pago_anuladoPorId_fkey` FOREIGN KEY (`anuladoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pago` ADD CONSTRAINT `Pago_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
