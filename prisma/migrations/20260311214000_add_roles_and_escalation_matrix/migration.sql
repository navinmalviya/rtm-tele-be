DO $$
BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'SR_DSTE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'DSTE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'ADSTE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'TCM';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EscalationMatrix" (
  "id" TEXT NOT NULL,
  "divisionId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "targetRole" "UserRole" NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EscalationMatrix_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EscalationMatrix_divisionId_level_key"
  ON "EscalationMatrix"("divisionId", "level");

CREATE INDEX IF NOT EXISTS "EscalationMatrix_divisionId_isActive_idx"
  ON "EscalationMatrix"("divisionId", "isActive");

DO $$
BEGIN
  ALTER TABLE "EscalationMatrix"
    ADD CONSTRAINT "EscalationMatrix_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "Division"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EscalationMatrix"
    ADD CONSTRAINT "EscalationMatrix_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
