-- Add optional unit field for users
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "unit" TEXT;

-- Add optional cable supervisor
ALTER TABLE "Cable"
ADD COLUMN IF NOT EXISTS "supervisorId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Cable_supervisorId_fkey'
      AND table_name = 'Cable'
  ) THEN
    ALTER TABLE "Cable"
    ADD CONSTRAINT "Cable_supervisorId_fkey"
    FOREIGN KEY ("supervisorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Cable_supervisorId_idx" ON "Cable"("supervisorId");

-- Allow duplicate serial numbers on equipment
DROP INDEX IF EXISTS "Equipment_serialNumber_key";

-- Station supervisors mapping table
CREATE TABLE IF NOT EXISTS "StationSupervisor" (
  "id" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "supervisorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StationSupervisor_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StationSupervisor_stationId_fkey'
      AND table_name = 'StationSupervisor'
  ) THEN
    ALTER TABLE "StationSupervisor"
    ADD CONSTRAINT "StationSupervisor_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "Station"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StationSupervisor_supervisorId_fkey'
      AND table_name = 'StationSupervisor'
  ) THEN
    ALTER TABLE "StationSupervisor"
    ADD CONSTRAINT "StationSupervisor_supervisorId_fkey"
    FOREIGN KEY ("supervisorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StationSupervisor_stationId_supervisorId_key"
ON "StationSupervisor"("stationId", "supervisorId");

CREATE INDEX IF NOT EXISTS "StationSupervisor_supervisorId_idx"
ON "StationSupervisor"("supervisorId");
