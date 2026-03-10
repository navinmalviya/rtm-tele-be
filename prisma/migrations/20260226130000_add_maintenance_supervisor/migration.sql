-- AlterTable
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "supervisorId" TEXT;

-- Backfill existing schedules to creator (safe fallback)
UPDATE "MaintenanceSchedule"
SET "supervisorId" = COALESCE(
  "createdById",
  (
    SELECT u."id"
    FROM "User" u
    WHERE u."divisionId" = (
      SELECT s."divisionId" FROM "Station" s WHERE s."id" = "MaintenanceSchedule"."stationId"
    )
    ORDER BY u."createdAt" ASC
    LIMIT 1
  ),
  (SELECT u2."id" FROM "User" u2 ORDER BY u2."createdAt" ASC LIMIT 1)
)
WHERE "supervisorId" IS NULL;

-- Enforce required after backfill
ALTER TABLE "MaintenanceSchedule" ALTER COLUMN "supervisorId" SET NOT NULL;

-- Index and FK
CREATE INDEX "MaintenanceSchedule_supervisorId_idx" ON "MaintenanceSchedule"("supervisorId");
ALTER TABLE "MaintenanceSchedule"
ADD CONSTRAINT "MaintenanceSchedule_supervisorId_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
