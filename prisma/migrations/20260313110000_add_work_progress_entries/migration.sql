CREATE TABLE IF NOT EXISTS "WorkProgressEntry" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "roundId" TEXT,
  "itemId" TEXT NOT NULL,
  "reportedById" TEXT NOT NULL,
  "stationId" TEXT,
  "subsectionId" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "linkedEquipmentId" TEXT,
  "progressDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkProgressEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkProgressEntry_workId_itemId_idx"
  ON "WorkProgressEntry"("workId", "itemId");

CREATE INDEX IF NOT EXISTS "WorkProgressEntry_roundId_idx"
  ON "WorkProgressEntry"("roundId");

CREATE INDEX IF NOT EXISTS "WorkProgressEntry_reportedById_idx"
  ON "WorkProgressEntry"("reportedById");

CREATE INDEX IF NOT EXISTS "WorkProgressEntry_stationId_idx"
  ON "WorkProgressEntry"("stationId");

CREATE INDEX IF NOT EXISTS "WorkProgressEntry_subsectionId_idx"
  ON "WorkProgressEntry"("subsectionId");

CREATE INDEX IF NOT EXISTS "WorkProgressEntry_linkedEquipmentId_idx"
  ON "WorkProgressEntry"("linkedEquipmentId");

DO $$
BEGIN
  ALTER TABLE "WorkProgressEntry"
    ADD CONSTRAINT "WorkProgressEntry_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "WorkExecution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkProgressEntry"
    ADD CONSTRAINT "WorkProgressEntry_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "WorkDemandRound"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkProgressEntry"
    ADD CONSTRAINT "WorkProgressEntry_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "WorkExecutionItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkProgressEntry"
    ADD CONSTRAINT "WorkProgressEntry_reportedById_fkey"
    FOREIGN KEY ("reportedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkProgressEntry"
    ADD CONSTRAINT "WorkProgressEntry_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "Station"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkProgressEntry"
    ADD CONSTRAINT "WorkProgressEntry_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkProgressEntry"
    ADD CONSTRAINT "WorkProgressEntry_linkedEquipmentId_fkey"
    FOREIGN KEY ("linkedEquipmentId") REFERENCES "Equipment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
