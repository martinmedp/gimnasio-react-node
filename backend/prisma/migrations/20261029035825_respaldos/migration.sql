-- CreateTable
CREATE TABLE `ConfiguracionRespaldo` (
    `id` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT false,
    `hora` VARCHAR(191) NOT NULL DEFAULT '20:00',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Respaldo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `origen` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `archivo` VARCHAR(191) NULL,
    `tamanoBytes` INTEGER NULL,
    `mensaje` TEXT NULL,
    `creadoPorId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Respaldo` ADD CONSTRAINT `Respaldo_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
