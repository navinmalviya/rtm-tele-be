-- CreateEnum
CREATE TYPE "StationCircuitStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "MaintenanceOccurrence"
  ADD COLUMN "inspectionChecklistSnapshot" JSONB,
  ADD COLUMN "inspectionChecklistResponses" JSONB;

-- CreateTable
CREATE TABLE "DivisionCircuitMaster" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "checklistSchema" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "divisionId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DivisionCircuitMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationCircuit" (
  "id" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "locationId" TEXT,
  "circuitMasterId" TEXT NOT NULL,
  "identifier" TEXT,
  "maintainedById" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "StationCircuitStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StationCircuit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DivisionCircuitMaster_divisionId_code_key" ON "DivisionCircuitMaster"("divisionId", "code");
CREATE INDEX "StationCircuit_stationId_status_idx" ON "StationCircuit"("stationId", "status");
CREATE INDEX "StationCircuit_maintainedById_idx" ON "StationCircuit"("maintainedById");

-- AddForeignKey
ALTER TABLE "DivisionCircuitMaster" ADD CONSTRAINT "DivisionCircuitMaster_divisionId_fkey"
FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DivisionCircuitMaster" ADD CONSTRAINT "DivisionCircuitMaster_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StationCircuit" ADD CONSTRAINT "StationCircuit_stationId_fkey"
FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StationCircuit" ADD CONSTRAINT "StationCircuit_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StationCircuit" ADD CONSTRAINT "StationCircuit_circuitMasterId_fkey"
FOREIGN KEY ("circuitMasterId") REFERENCES "DivisionCircuitMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StationCircuit" ADD CONSTRAINT "StationCircuit_maintainedById_fkey"
FOREIGN KEY ("maintainedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StationCircuit" ADD CONSTRAINT "StationCircuit_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StationCircuit" ADD CONSTRAINT "StationCircuit_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
