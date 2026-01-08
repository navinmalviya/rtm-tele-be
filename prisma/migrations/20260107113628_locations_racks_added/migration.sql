/*
  Warnings:

  - You are about to drop the `Device` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('NETWORKING', 'POWER', 'TRANSMISSION', 'COMPUTING', 'SENSORS', 'PASSIVE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('OPERATIONAL', 'FAULTY', 'MAINTENANCE', 'SPARE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "RackType" AS ENUM ('FLOOR_STANDING', 'WALL_MOUNTED', 'OUTDOOR_CABINET', 'BATTERY_STAND');

-- CreateEnum
CREATE TYPE "PortType" AS ENUM ('RJ45', 'SFP', 'FIBER_LC', 'FIBER_SC', 'E1', 'SERIAL', 'DC_TERMINAL', 'AC_PLUG');

-- CreateEnum
CREATE TYPE "PortStatus" AS ENUM ('UP', 'DOWN', 'RESERVED', 'FAULTY');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PLANNED');

-- DropTable
DROP TABLE "Device";

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RackType" NOT NULL DEFAULT 'FLOOR_STANDING',
    "heightU" INTEGER DEFAULT 42,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "partNumber" TEXT,
    "category" "EquipmentCategory" NOT NULL,
    "subType" TEXT NOT NULL,
    "isCoreEquipment" BOOLEAN NOT NULL DEFAULT false,
    "mapX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mapY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacityValue" DOUBLE PRECISION,
    "capacityUnit" TEXT,
    "ipAddress" TEXT,
    "uPosition" INTEGER,
    "uHeight" INTEGER DEFAULT 1,
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "installationDate" TIMESTAMP(3),
    "codalLifeYears" INTEGER,
    "isAmc" BOOLEAN NOT NULL DEFAULT false,
    "amcExpiry" TIMESTAMP(3),
    "stationId" TEXT NOT NULL,
    "rackId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PortType" NOT NULL DEFAULT 'RJ45',
    "status" "PortStatus" NOT NULL DEFAULT 'DOWN',
    "speed" TEXT,
    "ipAddress" TEXT,
    "vlanMode" TEXT NOT NULL DEFAULT 'ACCESS',
    "vlanIds" TEXT,
    "equipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortLink" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "cableType" TEXT,
    "length" DOUBLE PRECISION,
    "sourcePortId" TEXT NOT NULL,
    "targetPortId" TEXT NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_stationId_idx" ON "Location"("stationId");

-- CreateIndex
CREATE INDEX "Rack_locationId_idx" ON "Rack"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_serialNumber_key" ON "Equipment"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_ipAddress_key" ON "Equipment"("ipAddress");

-- CreateIndex
CREATE INDEX "Equipment_stationId_idx" ON "Equipment"("stationId");

-- CreateIndex
CREATE INDEX "Equipment_rackId_idx" ON "Equipment"("rackId");

-- CreateIndex
CREATE UNIQUE INDEX "Port_ipAddress_key" ON "Port"("ipAddress");

-- CreateIndex
CREATE INDEX "Port_equipmentId_idx" ON "Port"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PortLink_sourcePortId_targetPortId_key" ON "PortLink"("sourcePortId", "targetPortId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rack" ADD CONSTRAINT "Rack_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortLink" ADD CONSTRAINT "PortLink_sourcePortId_fkey" FOREIGN KEY ("sourcePortId") REFERENCES "Port"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortLink" ADD CONSTRAINT "PortLink_targetPortId_fkey" FOREIGN KEY ("targetPortId") REFERENCES "Port"("id") ON DELETE CASCADE ON UPDATE CASCADE;
