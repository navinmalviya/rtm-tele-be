CREATE TABLE IF NOT EXISTS "WorkExecutionStationScope" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkExecutionStationScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkExecutionSubsectionScope" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "subsectionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkExecutionSubsectionScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkExecutionStationScope_workId_stationId_key"
  ON "WorkExecutionStationScope"("workId", "stationId");

CREATE INDEX IF NOT EXISTS "WorkExecutionStationScope_stationId_idx"
  ON "WorkExecutionStationScope"("stationId");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkExecutionSubsectionScope_workId_subsectionId_key"
  ON "WorkExecutionSubsectionScope"("workId", "subsectionId");

CREATE INDEX IF NOT EXISTS "WorkExecutionSubsectionScope_subsectionId_idx"
  ON "WorkExecutionSubsectionScope"("subsectionId");

DO $$
BEGIN
  ALTER TABLE "WorkExecutionStationScope"
    ADD CONSTRAINT "WorkExecutionStationScope_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "WorkExecution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkExecutionStationScope"
    ADD CONSTRAINT "WorkExecutionStationScope_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "Station"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkExecutionSubsectionScope"
    ADD CONSTRAINT "WorkExecutionSubsectionScope_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "WorkExecution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkExecutionSubsectionScope"
    ADD CONSTRAINT "WorkExecutionSubsectionScope_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
