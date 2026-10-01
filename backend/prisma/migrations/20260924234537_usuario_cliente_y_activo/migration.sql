/*
  Warnings:

  - A unique constraint covering the columns `[clienteId]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `clienteId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Usuario_clienteId_key` ON `Usuario`(`clienteId`);

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
