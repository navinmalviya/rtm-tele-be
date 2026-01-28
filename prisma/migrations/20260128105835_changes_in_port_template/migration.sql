/*
  Warnings:

  - You are about to drop the column `brand` on the `EquipmentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `EquipmentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the `NetworkInstance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NetworkTemplate` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[assetTag]` on the table `Equipment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourcePortId]` on the table `PortLink` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[targetPortId]` on the table `PortLink` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `Equipment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providedBy` to the `Equipment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `make` to the `EquipmentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subCategory` to the `EquipmentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supply` to the `EquipmentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EquipmentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `templateId` to the `Port` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `PortTemplate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EquipmentSubCategory" AS ENUM ('L2_SWITCH', 'L3_SWITCH', 'ROUTER', 'WIFI_ROUTER', 'ACCESS_POINT', 'BATTERY_SET', 'UPS', 'CHARGER', 'SOLAR_CONTROLLER', 'STM_NODE', 'PD_MUX', 'MEDIA_CONVERTER', 'SERVER', 'WORKSTATION', 'LIU', 'PATCH_PANEL');

-- CreateEnum
CREATE TYPE "PortCategory" AS ENUM ('NETWORK', 'POWER');

-- CreateEnum
CREATE TYPE "SFPType" AS ENUM ('NOT_APPLICABLE', 'LC_SINGLE_POLE', 'LC_DUAL_POLE', 'SC_SIMPLEX');

-- CreateEnum
CREATE TYPE "PortStatus" AS ENUM ('FREE', 'IN_USE', 'FAULTY', 'RESERVED');

-- CreateEnum
CREATE TYPE "NetworkMode" AS ENUM ('ACCESS', 'TRUNK');

-- DropForeignKey
ALTER TABLE "NetworkInstance" DROP CONSTRAINT "NetworkInstance_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "NetworkTemplate" DROP CONSTRAINT "NetworkTemplate_templateId_fkey";

-- DropForeignKey
ALTER TABLE "PortTemplate" DROP CONSTRAINT "PortTemplate_equipmentTemplateId_fkey";

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "assetTag" TEXT,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "installationDate" TIMESTAMP(3),
ADD COLUMN     "providedBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "EquipmentTemplate" DROP COLUMN "brand",
DROP COLUMN "icon",
ADD COLUMN     "capacityAh" DOUBLE PRECISION,
ADD COLUMN     "capacityKva" DOUBLE PRECISION,
ADD COLUMN     "chemistry" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "defaultCellCount" INTEGER DEFAULT 1,
ADD COLUMN     "isModular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPoe" BOOLEAN DEFAULT false,
ADD COLUMN     "layer" INTEGER,
ADD COLUMN     "make" TEXT NOT NULL,
ADD COLUMN     "nominalCellVolt" DOUBLE PRECISION DEFAULT 2.0,
ADD COLUMN     "operatingMode" TEXT,
ADD COLUMN     "subCategory" "EquipmentSubCategory" NOT NULL,
ADD COLUMN     "supply" TEXT NOT NULL,
ADD COLUMN     "switchingCapacity" DOUBLE PRECISION,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Port" DROP COLUMN "type",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "ipPool" TEXT,
ADD COLUMN     "portMode" "NetworkMode" NOT NULL DEFAULT 'ACCESS',
ADD COLUMN     "status" "PortStatus" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "templateId" TEXT NOT NULL,
ADD COLUMN     "vlans" TEXT;

-- AlterTable
ALTER TABLE "PortLink" ADD COLUMN     "cableColor" TEXT,
ADD COLUMN     "circuitId" TEXT,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "mediaType" TEXT;

-- AlterTable
ALTER TABLE "PortTemplate" ADD COLUMN     "category" "PortCategory" NOT NULL DEFAULT 'NETWORK',
ADD COLUMN     "isSFPInserted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sfpType" "SFPType" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "voltage" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropTable
DROP TABLE "NetworkInstance";

-- DropTable
DROP TABLE "NetworkTemplate";

-- DropEnum
DROP TYPE "PortType";

-- CreateTable
CREATE TABLE "BatteryCell" (
    "id" TEXT NOT NULL,
    "cellIndex" INTEGER NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "BatteryCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circuit" (
    "id" TEXT NOT NULL,
    "circuitIdString" TEXT NOT NULL,
    "description" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Circuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitAuditLog" (
    "id" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircuitAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EquipmentToPorts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EquipmentToPorts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EquipmentCircuits" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EquipmentCircuits_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PortCircuits" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PortCircuits_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LinkCircuits" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LinkCircuits_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Circuit_circuitIdString_key" ON "Circuit"("circuitIdString");

-- CreateIndex
CREATE INDEX "_EquipmentToPorts_B_index" ON "_EquipmentToPorts"("B");

-- CreateIndex
CREATE INDEX "_EquipmentCircuits_B_index" ON "_EquipmentCircuits"("B");

-- CreateIndex
CREATE INDEX "_PortCircuits_B_index" ON "_PortCircuits"("B");

-- CreateIndex
CREATE INDEX "_LinkCircuits_B_index" ON "_LinkCircuits"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_assetTag_key" ON "Equipment"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "PortLink_sourcePortId_key" ON "PortLink"("sourcePortId");

-- CreateIndex
CREATE UNIQUE INDEX "PortLink_targetPortId_key" ON "PortLink"("targetPortId");

-- AddForeignKey
ALTER TABLE "BatteryCell" ADD CONSTRAINT "BatteryCell_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PortTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircuitAuditLog" ADD CONSTRAINT "CircuitAuditLog_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircuitAuditLog" ADD CONSTRAINT "CircuitAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentToPorts" ADD CONSTRAINT "_EquipmentToPorts_A_fkey" FOREIGN KEY ("A") REFERENCES "EquipmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentToPorts" ADD CONSTRAINT "_EquipmentToPorts_B_fkey" FOREIGN KEY ("B") REFERENCES "PortTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentCircuits" ADD CONSTRAINT "_EquipmentCircuits_A_fkey" FOREIGN KEY ("A") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentCircuits" ADD CONSTRAINT "_EquipmentCircuits_B_fkey" FOREIGN KEY ("B") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PortCircuits" ADD CONSTRAINT "_PortCircuits_A_fkey" FOREIGN KEY ("A") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PortCircuits" ADD CONSTRAINT "_PortCircuits_B_fkey" FOREIGN KEY ("B") REFERENCES "Port"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LinkCircuits" ADD CONSTRAINT "_LinkCircuits_A_fkey" FOREIGN KEY ("A") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LinkCircuits" ADD CONSTRAINT "_LinkCircuits_B_fkey" FOREIGN KEY ("B") REFERENCES "PortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
