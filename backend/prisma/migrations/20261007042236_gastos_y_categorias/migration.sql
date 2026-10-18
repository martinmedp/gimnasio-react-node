-- AlterTable
ALTER TABLE `cierrecaja` ADD COLUMN `totalGastos` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    ADD COLUMN `totalGastosEfectivo` DECIMAL(65, 30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `CategoriaGasto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CategoriaGasto_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Gasto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoriaId` INTEGER NOT NULL,
    `descripcion` TEXT NOT NULL,
    `monto` DECIMAL(65, 30) NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metodoPago` VARCHAR(191) NOT NULL,
    `registradoPorId` INTEGER NOT NULL,
    `cierreCajaId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Gasto` ADD CONSTRAINT `Gasto_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `CategoriaGasto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Gasto` ADD CONSTRAINT `Gasto_registradoPorId_fkey` FOREIGN KEY (`registradoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Gasto` ADD CONSTRAINT `Gasto_cierreCajaId_fkey` FOREIGN KEY (`cierreCajaId`) REFERENCES `CierreCaja`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
