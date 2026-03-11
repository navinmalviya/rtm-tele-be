-- 1) Location-level supervisor (JE/SSE)
ALTER TABLE "Location" ADD COLUMN "supervisorId" TEXT;

UPDATE "Location" l
SET "supervisorId" = s."supervisorId"
FROM "Station" s
WHERE l."stationId" = s."id" AND l."supervisorId" IS NULL;

UPDATE "Location" l
SET "supervisorId" = (
  SELECT u."id"
  FROM "User" u
  JOIN "Station" s2 ON s2."divisionId" = u."divisionId"
  WHERE s2."id" = l."stationId"
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE l."supervisorId" IS NULL;

ALTER TABLE "Location" ALTER COLUMN "supervisorId" SET NOT NULL;
CREATE INDEX "Location_supervisorId_idx" ON "Location"("supervisorId");
ALTER TABLE "Location"
ADD CONSTRAINT "Location_supervisorId_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Separate table for station-internal location cables
CREATE TABLE "StationCable" (
  "id" TEXT NOT NULL,
  "type" "CableType" NOT NULL,
  "subType" "CableSubType" NOT NULL,
  "maintenanceBy" TEXT NOT NULL,
  "length" TEXT NOT NULL,
  "dateOfCommissioning" TIMESTAMP(3),
  "quadCount" INTEGER NOT NULL DEFAULT 0,
  "pairCount" INTEGER NOT NULL DEFAULT 0,
  "fiberCount" INTEGER NOT NULL DEFAULT 0,
  "tubeCount" INTEGER NOT NULL DEFAULT 0,
  "fromLocationId" TEXT NOT NULL,
  "toLocationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StationCable_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StationCable_fromLocationId_idx" ON "StationCable"("fromLocationId");
CREATE INDEX "StationCable_toLocationId_idx" ON "StationCable"("toLocationId");

ALTER TABLE "StationCable"
ADD CONSTRAINT "StationCable_fromLocationId_fkey"
FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StationCable"
ADD CONSTRAINT "StationCable_toLocationId_fkey"
FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StationCable"
ADD CONSTRAINT "StationCable_from_to_different_check"
CHECK ("fromLocationId" <> "toLocationId");
