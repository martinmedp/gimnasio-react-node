-- AlterTable
ALTER TABLE `cierrecaja` ADD COLUMN `motivoReversion` TEXT NULL,
    ADD COLUMN `revertido` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `revertidoEn` DATETIME(3) NULL,
    ADD COLUMN `revertidoPorId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `CierreCaja` ADD CONSTRAINT `CierreCaja_revertidoPorId_fkey` FOREIGN KEY (`revertidoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
