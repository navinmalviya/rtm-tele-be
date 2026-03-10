-- AlterTable
ALTER TABLE "Station" ADD COLUMN "supervisorId" TEXT;
ALTER TABLE "Subsection" ADD COLUMN "supervisorId" TEXT;

-- Backfill from creator for existing records
UPDATE "Station" SET "supervisorId" = "createdById" WHERE "supervisorId" IS NULL;
UPDATE "Subsection" SET "supervisorId" = "createdById" WHERE "supervisorId" IS NULL;

-- Enforce required
ALTER TABLE "Station" ALTER COLUMN "supervisorId" SET NOT NULL;
ALTER TABLE "Subsection" ALTER COLUMN "supervisorId" SET NOT NULL;

-- Indexes
CREATE INDEX "Station_supervisorId_idx" ON "Station"("supervisorId");
CREATE INDEX "Subsection_supervisorId_idx" ON "Subsection"("supervisorId");

-- Foreign keys
ALTER TABLE "Station"
ADD CONSTRAINT "Station_supervisorId_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subsection"
ADD CONSTRAINT "Subsection_supervisorId_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
