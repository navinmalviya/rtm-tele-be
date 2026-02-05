/*
  Warnings:

  - You are about to drop the column `isAckByIncharge` on the `CableCut` table. All the data in the column will be lost.
  - You are about to drop the column `isAckByTestroom` on the `CableCut` table. All the data in the column will be lost.
  - You are about to drop the column `ticketId` on the `CableCut` table. All the data in the column will be lost.
  - You are about to drop the column `subsectionId` on the `Station` table. All the data in the column will be lost.
  - You are about to drop the column `ticketId` on the `TRCRequest` table. All the data in the column will be lost.
  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[taskId]` on the table `TRCRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `taskId` to the `TRCRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FAILURE', 'TRC', 'MAINTENANCE', 'PROJECT');

-- CreateEnum
CREATE TYPE "FailureType" AS ENUM ('AXLE_COUTER', 'BLOCK', 'SECTION_CONTROL', 'TPC_CONTROL', 'SI_CONTROL', 'PRS', 'FOIS', 'AUTO_PHONE', 'RAILNET', 'CMS_SERVER', 'CGDB_BOARD', 'PA_SYSTEM', 'MISC');

-- CreateEnum
CREATE TYPE "CauseOfFailure" AS ENUM ('EQUIPMENT_FAILURE', 'PATCH_CORD_FAILURE', 'CABLE_CUT', 'CABLE_DAMAGED', 'PORT_FAILURE', 'KRONE_FAILURE', 'WAGO_FAILURE', 'LOW_INSULATION', 'HIGH_LOSS');

-- DropForeignKey
ALTER TABLE "CableCut" DROP CONSTRAINT "CableCut_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "Station" DROP CONSTRAINT "Station_subsectionId_fkey";

-- DropForeignKey
ALTER TABLE "TRCRequest" DROP CONSTRAINT "TRCRequest_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_stationId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_subsectionId_fkey";

-- DropIndex
DROP INDEX "CableCut_ticketId_key";

-- DropIndex
DROP INDEX "TRCRequest_ticketId_key";

-- AlterTable
ALTER TABLE "CableCut" DROP COLUMN "isAckByIncharge",
DROP COLUMN "isAckByTestroom",
DROP COLUMN "ticketId";

-- AlterTable
ALTER TABLE "Station" DROP COLUMN "subsectionId";

-- AlterTable
ALTER TABLE "TRCRequest" DROP COLUMN "ticketId",
ADD COLUMN     "taskId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Ticket";

-- DropEnum
DROP TYPE "TicketType";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "totalProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "weight" DOUBLE PRECISION,
    "projectId" TEXT,
    "ownerId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachment" TEXT,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Failure" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "FailureType" NOT NULL,
    "cause" "CauseOfFailure" NOT NULL,
    "locationId" TEXT,
    "subsectionId" TEXT,
    "stationId" TEXT,
    "cableCutId" TEXT,
    "restorationTime" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "Failure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,
    "stationId" TEXT,
    "equipmentId" TEXT,
    "remarks" TEXT,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StationToSubsection" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StationToSubsection_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Failure_taskId_key" ON "Failure"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Failure_cableCutId_key" ON "Failure"("cableCutId");

-- CreateIndex
CREATE UNIQUE INDEX "Maintenance_taskId_key" ON "Maintenance"("taskId");

-- CreateIndex
CREATE INDEX "_StationToSubsection_B_index" ON "_StationToSubsection"("B");

-- CreateIndex
CREATE UNIQUE INDEX "TRCRequest_taskId_key" ON "TRCRequest"("taskId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_cableCutId_fkey" FOREIGN KEY ("cableCutId") REFERENCES "CableCut"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TRCRequest" ADD CONSTRAINT "TRCRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StationToSubsection" ADD CONSTRAINT "_StationToSubsection_A_fkey" FOREIGN KEY ("A") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StationToSubsection" ADD CONSTRAINT "_StationToSubsection_B_fkey" FOREIGN KEY ("B") REFERENCES "Subsection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
