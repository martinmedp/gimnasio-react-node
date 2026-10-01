/*
  Warnings:

  - Added the required column `registradoPorId` to the `Pago` table without a default value. This is not possible if the table is not empty.

*/

-- Paso 1: agregamos la columna como OPCIONAL (permite NULL temporalmente),
-- para no romper las 3 filas de Pago que ya existen
ALTER TABLE `pago` ADD COLUMN `registradoPorId` INTEGER NULL;

-- Paso 2: rellenamos esas filas existentes con el id de tu Administrador (1),
-- ya que esos pagos de prueba no tenían un responsable registrado hasta ahora
UPDATE `pago` SET `registradoPorId` = 1 WHERE `registradoPorId` IS NULL;

-- Paso 3: ahora que TODAS las filas tienen un valor, hacemos la columna
-- obligatoria (NOT NULL), cumpliendo lo que pide el schema.prisma
ALTER TABLE `pago` MODIFY COLUMN `registradoPorId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Pago` ADD CONSTRAINT `Pago_registradoPorId_fkey` FOREIGN KEY (`registradoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;