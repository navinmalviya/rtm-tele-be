/*
  Warnings:

  - The values [ADMIN,EDITOR] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `amcExpiry` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `capacityUnit` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `capacityValue` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `codalLifeYears` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `installationDate` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `isAmc` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `isCoreEquipment` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `mapX` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `mapY` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `partNumber` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `subType` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `uHeight` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `speed` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `vlanIds` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `vlanMode` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `cableType` on the `PortLink` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `PortLink` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `PortLink` table. All the data in the column will be lost.
  - You are about to drop the column `length` on the `PortLink` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `PortLink` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PortLink` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Rack` table. All the data in the column will be lost.
  - You are about to drop the column `heightU` on the `Rack` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Rack` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Rack` table. All the data in the column will be lost.
  - You are about to drop the column `section` on the `Station` table. All the data in the column will be lost.
  - You are about to drop the column `subSection` on the `Station` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Station` table. All the data in the column will be lost.
  - Added the required column `templateId` to the `Equipment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `divisionId` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `divisionId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('FAILURE', 'TRC', 'MAINTENANCE', 'COMPLAINT', 'INSTALLATION');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALFYEARLY', 'YEARLY');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'TESTROOM', 'FIELD_ENGINEER', 'SSE_INCHARGE', 'TRC', 'VIEWER', 'SSE_ST_OFFICE', 'SSE_TECH', 'MAINTAINER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- DropForeignKey
ALTER TABLE "Equipment" DROP CONSTRAINT "Equipment_stationId_fkey";

-- DropIndex
DROP INDEX "Equipment_ipAddress_key";

-- DropIndex
DROP INDEX "Equipment_rackId_idx";

-- DropIndex
DROP INDEX "Equipment_stationId_idx";

-- DropIndex
DROP INDEX "Location_stationId_idx";

-- DropIndex
DROP INDEX "Port_equipmentId_idx";

-- DropIndex
DROP INDEX "Port_ipAddress_key";

-- DropIndex
DROP INDEX "Rack_locationId_idx";

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "amcExpiry",
DROP COLUMN "capacityUnit",
DROP COLUMN "capacityValue",
DROP COLUMN "category",
DROP COLUMN "codalLifeYears",
DROP COLUMN "installationDate",
DROP COLUMN "ipAddress",
DROP COLUMN "isAmc",
DROP COLUMN "isCoreEquipment",
DROP COLUMN "mapX",
DROP COLUMN "mapY",
DROP COLUMN "partNumber",
DROP COLUMN "subType",
DROP COLUMN "uHeight",
ADD COLUMN     "templateId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "createdAt",
DROP COLUMN "description",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Port" DROP COLUMN "createdAt",
DROP COLUMN "ipAddress",
DROP COLUMN "speed",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
DROP COLUMN "vlanIds",
DROP COLUMN "vlanMode";

-- AlterTable
ALTER TABLE "PortLink" DROP COLUMN "cableType",
DROP COLUMN "createdAt",
DROP COLUMN "label",
DROP COLUMN "length",
DROP COLUMN "status",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Rack" DROP COLUMN "createdAt",
DROP COLUMN "heightU",
DROP COLUMN "type",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Station" DROP COLUMN "section",
DROP COLUMN "subSection",
DROP COLUMN "updatedAt",
ADD COLUMN     "divisionId" TEXT NOT NULL,
ADD COLUMN     "subsectionId" TEXT,
ALTER COLUMN "mapX" SET DEFAULT 0,
ALTER COLUMN "mapY" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "divisionId" TEXT NOT NULL,
ADD COLUMN     "inchargeId" TEXT;

-- DropEnum
DROP TYPE "LinkStatus";

-- DropEnum
DROP TYPE "PortStatus";

-- DropEnum
DROP TYPE "RackType";

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subsection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "fromStationId" TEXT NOT NULL,
    "toStationId" TEXT NOT NULL,

    CONSTRAINT "Subsection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentTemplate" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "uHeight" INTEGER NOT NULL DEFAULT 1,
    "codalLifeYears" INTEGER NOT NULL DEFAULT 12,
    "icon" TEXT,

    CONSTRAINT "EquipmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkTemplate" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isPoe" BOOLEAN NOT NULL DEFAULT false,
    "layer" INTEGER NOT NULL DEFAULT 2,
    "powerType" TEXT,

    CONSTRAINT "NetworkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PortType" NOT NULL DEFAULT 'RJ45',
    "speed" TEXT,
    "equipmentTemplateId" TEXT NOT NULL,

    CONSTRAINT "PortTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkInstance" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "mgmtIp" TEXT,
    "mgmtSubnet" TEXT,
    "mgmtGateway" TEXT,
    "role" TEXT,
    "networkDomain" TEXT,

    CONSTRAINT "NetworkInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "stationId" TEXT,
    "subsectionId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TRCRequest" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "certificateNo" TEXT,
    "receivedDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),

    CONSTRAINT "TRCRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cable" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "maintenanceBy" TEXT NOT NULL,
    "subsectionId" TEXT NOT NULL,

    CONSTRAINT "Cable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CableCut" (
    "id" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "locationKM" TEXT NOT NULL,
    "cutDateTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restorationDateTime" TIMESTAMP(3),
    "putRightDetails" TEXT,
    "isAckByIncharge" BOOLEAN NOT NULL DEFAULT false,
    "isAckByTestroom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CableCut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CableTestReport" (
    "id" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,
    "testedById" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "insulationRes" TEXT,
    "dbLoss" DOUBLE PRECISION,
    "isAckByIncharge" BOOLEAN NOT NULL DEFAULT false,
    "ackByInchargeById" TEXT,

    CONSTRAINT "CableTestReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocketTestingReport" (
    "id" TEXT NOT NULL,
    "locationKM" TEXT NOT NULL,
    "subsectionId" TEXT NOT NULL,
    "testedById" TEXT NOT NULL,
    "isFunctional" BOOLEAN NOT NULL DEFAULT true,
    "isAckByIncharge" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocketTestingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Joint" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,

    CONSTRAINT "Joint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "stationId" TEXT NOT NULL,

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "isAckByIncharge" BOOLEAN NOT NULL DEFAULT false,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMovement" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "locationPlanned" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DailyMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentTemplate_modelName_key" ON "EquipmentTemplate"("modelName");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkTemplate_templateId_key" ON "NetworkTemplate"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkInstance_equipmentId_key" ON "NetworkInstance"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TRCRequest_ticketId_key" ON "TRCRequest"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "CableCut_ticketId_key" ON "CableCut"("ticketId");

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subsection" ADD CONSTRAINT "Subsection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inchargeId_fkey" FOREIGN KEY ("inchargeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkTemplate" ADD CONSTRAINT "NetworkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EquipmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortTemplate" ADD CONSTRAINT "PortTemplate_equipmentTemplateId_fkey" FOREIGN KEY ("equipmentTemplateId") REFERENCES "EquipmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EquipmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkInstance" ADD CONSTRAINT "NetworkInstance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TRCRequest" ADD CONSTRAINT "TRCRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TRCRequest" ADD CONSTRAINT "TRCRequest_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cable" ADD CONSTRAINT "Cable_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableCut" ADD CONSTRAINT "CableCut_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableCut" ADD CONSTRAINT "CableCut_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableCut" ADD CONSTRAINT "CableCut_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableTestReport" ADD CONSTRAINT "CableTestReport_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableTestReport" ADD CONSTRAINT "CableTestReport_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableTestReport" ADD CONSTRAINT "CableTestReport_ackByInchargeById_fkey" FOREIGN KEY ("ackByInchargeById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketTestingReport" ADD CONSTRAINT "SocketTestingReport_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketTestingReport" ADD CONSTRAINT "SocketTestingReport_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Joint" ADD CONSTRAINT "Joint_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionNote" ADD CONSTRAINT "InspectionNote_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMovement" ADD CONSTRAINT "DailyMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
