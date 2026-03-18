DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CableTestingCause') THEN
		CREATE TYPE "CableTestingCause" AS ENUM (
			'SCHEDULED',
			'FAILURE',
			'POST_RESTORATION',
			'COMMISSIONING',
			'OTHER'
		);
	END IF;
END $$;

ALTER TABLE "CableTestReport"
	ADD COLUMN IF NOT EXISTS "measuredOn" TIMESTAMP(3),
	ADD COLUMN IF NOT EXISTS "testCause" "CableTestingCause" NOT NULL DEFAULT 'SCHEDULED',
	ADD COLUMN IF NOT EXISTS "sectionName" TEXT,
	ADD COLUMN IF NOT EXISTS "blockSectionName" TEXT,
	ADD COLUMN IF NOT EXISTS "cableRouteDistanceKm" DOUBLE PRECISION,
	ADD COLUMN IF NOT EXISTS "sectionLengthKm" DOUBLE PRECISION,
	ADD COLUMN IF NOT EXISTS "measuredAtStationId" TEXT,
	ADD COLUMN IF NOT EXISTS "calculatedLoopResistance" DOUBLE PRECISION,
	ADD COLUMN IF NOT EXISTS "calculatedAttenuation" DOUBLE PRECISION,
	ADD COLUMN IF NOT EXISTS "overallRemarks" TEXT,
	ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "CableTestMeasuredValue" (
	"id" TEXT NOT NULL,
	"reportId" TEXT NOT NULL,
	"srNo" INTEGER NOT NULL,
	"quadNo" INTEGER,
	"pairNo" INTEGER,
	"circuitName" TEXT,
	"transmissionLossDb" DOUBLE PRECISION,
	"loopResistanceOhm" DOUBLE PRECISION,
	"insulationL1E" DOUBLE PRECISION,
	"insulationL2E" DOUBLE PRECISION,
	"insulationL1L2" DOUBLE PRECISION,
	"remarks" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "CableTestMeasuredValue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CableTestReport_cableId_testDate_idx" ON "CableTestReport"("cableId", "testDate");
CREATE INDEX IF NOT EXISTS "CableTestReport_measuredAtStationId_idx" ON "CableTestReport"("measuredAtStationId");
CREATE INDEX IF NOT EXISTS "CableTestMeasuredValue_reportId_srNo_idx" ON "CableTestMeasuredValue"("reportId", "srNo");

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'CableTestReport_measuredAtStationId_fkey'
	) THEN
		ALTER TABLE "CableTestReport"
			ADD CONSTRAINT "CableTestReport_measuredAtStationId_fkey"
			FOREIGN KEY ("measuredAtStationId") REFERENCES "Station"("id")
			ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'CableTestMeasuredValue_reportId_fkey'
	) THEN
		ALTER TABLE "CableTestMeasuredValue"
			ADD CONSTRAINT "CableTestMeasuredValue_reportId_fkey"
			FOREIGN KEY ("reportId") REFERENCES "CableTestReport"("id")
			ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END $$;
