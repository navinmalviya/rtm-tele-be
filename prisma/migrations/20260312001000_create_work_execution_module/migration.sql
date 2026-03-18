DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkExecutionStatus') THEN
    CREATE TYPE "WorkExecutionStatus" AS ENUM (
      'DRAFT_ITEMS',
      'DEMAND_OPEN',
      'DEMAND_CLOSED',
      'ALLOCATED',
      'EXECUTION',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkItemCategory') THEN
    CREATE TYPE "WorkItemCategory" AS ENUM (
      'EQUIPMENT',
      'CABLE',
      'LABOUR',
      'CIVIL',
      'INSTALLATION',
      'TESTING',
      'COMMISSIONING',
      'OTHER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkDemandRoundStatus') THEN
    CREATE TYPE "WorkDemandRoundStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WorkExecution" (
  "id" TEXT NOT NULL,
  "divisionId" TEXT NOT NULL,
  "loaNo" TEXT NOT NULL,
  "loaDate" TIMESTAMP(3),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "contractorName" TEXT,
  "acceptedValue" DOUBLE PRECISION,
  "completionPeriodMonths" INTEGER,
  "plannedStartDate" TIMESTAMP(3),
  "plannedEndDate" TIMESTAMP(3),
  "engineerIncharge" TEXT,
  "status" "WorkExecutionStatus" NOT NULL DEFAULT 'DRAFT_ITEMS',
  "consigneeId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkExecutionItem" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "lineNo" INTEGER,
  "scheduleCode" TEXT,
  "itemCode" TEXT,
  "itemName" TEXT NOT NULL,
  "rawDescription" TEXT,
  "category" "WorkItemCategory" NOT NULL DEFAULT 'OTHER',
  "uom" TEXT NOT NULL,
  "plannedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unitRate" DOUBLE PRECISION,
  "plannedAmount" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkExecutionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkDemandRound" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "status" "WorkDemandRoundStatus" NOT NULL DEFAULT 'OPEN',
  "opensAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "closesAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkDemandRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkDemandEntry" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "stationId" TEXT,
  "subsectionId" TEXT,
  "requestedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkDemandEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkAllocationEntry" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "allocatedToId" TEXT NOT NULL,
  "allocatedById" TEXT NOT NULL,
  "stationId" TEXT,
  "subsectionId" TEXT,
  "allocatedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkAllocationEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkExecution_divisionId_loaNo_key"
  ON "WorkExecution"("divisionId", "loaNo");

CREATE INDEX IF NOT EXISTS "WorkExecution_divisionId_status_idx"
  ON "WorkExecution"("divisionId", "status");

CREATE INDEX IF NOT EXISTS "WorkExecutionItem_workId_isActive_idx"
  ON "WorkExecutionItem"("workId", "isActive");

CREATE INDEX IF NOT EXISTS "WorkDemandRound_workId_status_idx"
  ON "WorkDemandRound"("workId", "status");

CREATE INDEX IF NOT EXISTS "WorkDemandEntry_workId_roundId_requestedById_idx"
  ON "WorkDemandEntry"("workId", "roundId", "requestedById");

CREATE INDEX IF NOT EXISTS "WorkDemandEntry_itemId_idx"
  ON "WorkDemandEntry"("itemId");

CREATE INDEX IF NOT EXISTS "WorkDemandEntry_stationId_idx"
  ON "WorkDemandEntry"("stationId");

CREATE INDEX IF NOT EXISTS "WorkDemandEntry_subsectionId_idx"
  ON "WorkDemandEntry"("subsectionId");

CREATE INDEX IF NOT EXISTS "WorkAllocationEntry_workId_roundId_allocatedToId_idx"
  ON "WorkAllocationEntry"("workId", "roundId", "allocatedToId");

CREATE INDEX IF NOT EXISTS "WorkAllocationEntry_itemId_idx"
  ON "WorkAllocationEntry"("itemId");

CREATE INDEX IF NOT EXISTS "WorkAllocationEntry_stationId_idx"
  ON "WorkAllocationEntry"("stationId");

CREATE INDEX IF NOT EXISTS "WorkAllocationEntry_subsectionId_idx"
  ON "WorkAllocationEntry"("subsectionId");

DO $$
BEGIN
  ALTER TABLE "WorkExecution"
    ADD CONSTRAINT "WorkExecution_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "Division"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkExecution"
    ADD CONSTRAINT "WorkExecution_consigneeId_fkey"
    FOREIGN KEY ("consigneeId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkExecution"
    ADD CONSTRAINT "WorkExecution_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkExecutionItem"
    ADD CONSTRAINT "WorkExecutionItem_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "WorkExecution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandRound"
    ADD CONSTRAINT "WorkDemandRound_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "WorkExecution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandRound"
    ADD CONSTRAINT "WorkDemandRound_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandEntry"
    ADD CONSTRAINT "WorkDemandEntry_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "WorkExecution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandEntry"
    ADD CONSTRAINT "WorkDemandEntry_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "WorkDemandRound"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandEntry"
    ADD CONSTRAINT "WorkDemandEntry_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "WorkExecutionItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandEntry"
    ADD CONSTRAINT "WorkDemandEntry_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandEntry"
    ADD CONSTRAINT "WorkDemandEntry_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "Station"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkDemandEntry"
    ADD CONSTRAINT "WorkDemandEntry_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkAllocationEntry"
    ADD CONSTRAINT "WorkAllocationEntry_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "WorkExecution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkAllocationEntry"
    ADD CONSTRAINT "WorkAllocationEntry_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "WorkDemandRound"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkAllocationEntry"
    ADD CONSTRAINT "WorkAllocationEntry_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "WorkExecutionItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkAllocationEntry"
    ADD CONSTRAINT "WorkAllocationEntry_allocatedToId_fkey"
    FOREIGN KEY ("allocatedToId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkAllocationEntry"
    ADD CONSTRAINT "WorkAllocationEntry_allocatedById_fkey"
    FOREIGN KEY ("allocatedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkAllocationEntry"
    ADD CONSTRAINT "WorkAllocationEntry_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "Station"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkAllocationEntry"
    ADD CONSTRAINT "WorkAllocationEntry_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
