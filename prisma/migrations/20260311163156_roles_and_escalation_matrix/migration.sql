-- DropIndex
DROP INDEX "MaintenanceOccurrence_escalatedToId_idx";

-- DropIndex
DROP INDEX "MaintenanceOccurrence_status_dueDate_idx";

-- DropIndex
DROP INDEX "MaintenanceSchedule_scheduleType_idx";

-- DropIndex
DROP INDEX "MaintenanceSchedule_subsectionId_idx";

-- DropIndex
DROP INDEX "MaintenanceSchedule_targetScope_idx";

-- CreateIndex
CREATE INDEX "Cable_subsectionId_idx" ON "Cable"("subsectionId");

-- CreateIndex
CREATE INDEX "Location_stationId_idx" ON "Location"("stationId");
