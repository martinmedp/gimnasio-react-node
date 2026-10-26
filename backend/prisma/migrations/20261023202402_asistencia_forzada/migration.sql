-- AlterTable
ALTER TABLE `asistencia` ADD COLUMN `autorizadaPorId` INTEGER NULL,
    ADD COLUMN `forzada` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `motivoForzada` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Asistencia` ADD CONSTRAINT `Asistencia_autorizadaPorId_fkey` FOREIGN KEY (`autorizadaPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
