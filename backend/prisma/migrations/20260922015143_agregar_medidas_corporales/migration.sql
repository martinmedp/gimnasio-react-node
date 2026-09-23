-- AlterTable
ALTER TABLE `cliente` ADD COLUMN `estatura` DOUBLE NULL;

-- CreateTable
CREATE TABLE `MedidaCorporal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `peso` DOUBLE NULL,
    `porcentajeGrasa` DOUBLE NULL,
    `circunferenciaPecho` DOUBLE NULL,
    `circunferenciaCintura` DOUBLE NULL,
    `circunferenciaCadera` DOUBLE NULL,
    `circunferenciaBrazo` DOUBLE NULL,
    `circunferenciaMuslo` DOUBLE NULL,
    `circunferenciaPantorrilla` DOUBLE NULL,
    `circunferenciaCuello` DOUBLE NULL,
    `notas` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MedidaCorporal` ADD CONSTRAINT `MedidaCorporal_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
