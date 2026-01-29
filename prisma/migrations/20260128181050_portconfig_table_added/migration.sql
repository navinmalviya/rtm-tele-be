/*
  Warnings:

  - You are about to drop the column `chemistry` on the `EquipmentTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EquipmentTemplate" DROP COLUMN "chemistry",
ADD COLUMN     "batteryType" TEXT,
ADD COLUMN     "isMPLSEnables" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSMRBased" BOOLEAN;

-- CreateTable
CREATE TABLE "EquipmentPortConfig" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipmentTemplateId" TEXT NOT NULL,
    "portTemplateId" TEXT NOT NULL,

    CONSTRAINT "EquipmentPortConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentPortConfig_equipmentTemplateId_portTemplateId_key" ON "EquipmentPortConfig"("equipmentTemplateId", "portTemplateId");

-- AddForeignKey
ALTER TABLE "EquipmentPortConfig" ADD CONSTRAINT "EquipmentPortConfig_equipmentTemplateId_fkey" FOREIGN KEY ("equipmentTemplateId") REFERENCES "EquipmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentPortConfig" ADD CONSTRAINT "EquipmentPortConfig_portTemplateId_fkey" FOREIGN KEY ("portTemplateId") REFERENCES "PortTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
