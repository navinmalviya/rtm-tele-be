-- CreateEnum
CREATE TYPE "MaintenanceScheduleType" AS ENUM ('STATION_INSPECTION_MAINTENANCE', 'CABLE_TESTING', 'EC_SOCKET_TESTING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MaintenanceTargetScope" AS ENUM ('STATION', 'SUBSECTION');

-- AlterTable
ALTER TABLE "MaintenanceSchedule"
  ADD COLUMN "scheduleType" "MaintenanceScheduleType" NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "targetScope" "MaintenanceTargetScope" NOT NULL DEFAULT 'STATION',
  ADD COLUMN "jointFrequency" "Frequency",
  ADD COLUMN "isJointSchedule" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "jointDepartment" TEXT,
  ADD COLUMN "allowedVarianceDays" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "escalationRole" "UserRole" NOT NULL DEFAULT 'SSE_TELE_INCHARGE',
  ADD COLUMN "subsectionId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceOccurrence"
  ADD COLUMN "jointDoneWithName" TEXT,
  ADD COLUMN "jointDoneWithDesignation" TEXT,
  ADD COLUMN "jointDoneWithDepartment" TEXT,
  ADD COLUMN "escalatedAt" TIMESTAMP(3),
  ADD COLUMN "escalatedToId" TEXT;

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_scheduleType_idx" ON "MaintenanceSchedule"("scheduleType");
CREATE INDEX "MaintenanceSchedule_targetScope_idx" ON "MaintenanceSchedule"("targetScope");
CREATE INDEX "MaintenanceSchedule_subsectionId_idx" ON "MaintenanceSchedule"("subsectionId");
CREATE INDEX "MaintenanceOccurrence_status_dueDate_idx" ON "MaintenanceOccurrence"("status", "dueDate");
CREATE INDEX "MaintenanceOccurrence_escalatedToId_idx" ON "MaintenanceOccurrence"("escalatedToId");

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_subsectionId_fkey"
FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOccurrence" ADD CONSTRAINT "MaintenanceOccurrence_escalatedToId_fkey"
FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
