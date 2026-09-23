/*
  Warnings:

  - A unique constraint covering the columns `[clienteId,diaSemana]` on the table `Rutina` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `diaSemana` to the `Rutina` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ejercicio` ADD COLUMN `imagenUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `rutina` ADD COLUMN `diaSemana` ENUM('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Rutina_clienteId_diaSemana_key` ON `Rutina`(`clienteId`, `diaSemana`);
