/*
  Warnings:

  - Added the required column `updatedAt` to the `CableCut` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Joint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `MaintenanceSchedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MaintenanceSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'COMPLETED', 'OVERDUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EquipmentCategory" ADD VALUE 'SIGNALLING';
ALTER TYPE "EquipmentCategory" ADD VALUE 'PASSENGER_AMENITIES';
ALTER TYPE "EquipmentCategory" ADD VALUE 'SECURITY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EquipmentSubCategory" ADD VALUE 'FIREWALL';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'SMR';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'MRO_MUX';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'BPAC';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'BLOCK_INSTRUMENT';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'UFSBI';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'HASSDAC';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'KAVACH_UNIT';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'PA_SYSTEM';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'PIDS_BOARD';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'CCTV_CAMERA';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'NVR_VMS';
ALTER TYPE "EquipmentSubCategory" ADD VALUE 'CT_BOX';

-- AlterEnum
ALTER TYPE "PortCategory" ADD VALUE 'SERIAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'SR_DSTE_CO';
ALTER TYPE "UserRole" ADD VALUE 'DSTE';
ALTER TYPE "UserRole" ADD VALUE 'ADSTE';
ALTER TYPE "UserRole" ADD VALUE 'SSE_SECTIONAL';
ALTER TYPE "UserRole" ADD VALUE 'JE_SECTIONAL';
ALTER TYPE "UserRole" ADD VALUE 'TECHNICIAN';
ALTER TYPE "UserRole" ADD VALUE 'AUDIT_USER';

-- AlterTable
ALTER TABLE "CableCut" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Failure" ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "failureReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "slaBreachedAt" TIMESTAMP(3),
ADD COLUMN     "slaDueAt" TIMESTAMP(3),
ADD COLUMN     "sseInchargeById" TEXT,
ADD COLUMN     "sseInchargeRemark" TEXT,
ADD COLUMN     "sseInchargeRemarkAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Joint" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "MaintenanceSchedule" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "equipmentId" TEXT,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "remindBeforeDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "TaskEscalationLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromLevel" INTEGER,
    "toLevel" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "escalatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEscalationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceOccurrence" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "remarks" TEXT,
    "proofUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceOccurrence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_sseInchargeById_fkey" FOREIGN KEY ("sseInchargeById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEscalationLog" ADD CONSTRAINT "TaskEscalationLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEscalationLog" ADD CONSTRAINT "TaskEscalationLog_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOccurrence" ADD CONSTRAINT "MaintenanceOccurrence_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOccurrence" ADD CONSTRAINT "MaintenanceOccurrence_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
