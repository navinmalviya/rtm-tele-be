-- CreateEnum
CREATE TYPE "DailyReportSectionType" AS ENUM (
  'CORE_FAILURE',
  'BSNL_FCT',
  'OFC_DEFICIENCY',
  'QUAD6_DEFICIENCY',
  'EXPOSED_CABLE',
  'WIFI_STATUS',
  'CCTV_STATUS',
  'WT_TESTING',
  'MOVEMENT',
  'NOTE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "DailyInputSourceType" AS ENUM ('FIELD_APP', 'TELEPHONIC', 'WHATSAPP', 'MANUAL');

-- CreateEnum
CREATE TYPE "DailyReportExportFormat" AS ENUM ('EXCEL', 'GRAPHICAL');

-- CreateTable
CREATE TABLE "DailyReportInput" (
  "id" TEXT NOT NULL,
  "divisionId" TEXT NOT NULL,
  "reportDate" TIMESTAMP(3) NOT NULL,
  "sectionType" "DailyReportSectionType" NOT NULL,
  "stationId" TEXT,
  "subsectionId" TEXT,
  "entryTitle" TEXT NOT NULL,
  "entryDetails" TEXT NOT NULL,
  "entryStatus" TEXT,
  "failureInTime" TIMESTAMP(3),
  "restorationTime" TIMESTAMP(3),
  "targetDate" TIMESTAMP(3),
  "complianceDate" TIMESTAMP(3),
  "informedTo" TEXT,
  "responsibleDept" TEXT,
  "isFallbackEntry" BOOLEAN NOT NULL DEFAULT false,
  "sourceType" "DailyInputSourceType" NOT NULL DEFAULT 'FIELD_APP',
  "sourceContactName" TEXT,
  "sourceContactDesignation" TEXT,
  "sourceContactChannel" TEXT,
  "submittedById" TEXT NOT NULL,
  "inputForUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyReportInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportRun" (
  "id" TEXT NOT NULL,
  "divisionId" TEXT NOT NULL,
  "reportDate" TIMESTAMP(3) NOT NULL,
  "format" "DailyReportExportFormat" NOT NULL,
  "filters" JSONB,
  "summary" JSONB,
  "entryCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "fileName" TEXT,
  "generatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReportInput_divisionId_reportDate_idx" ON "DailyReportInput"("divisionId", "reportDate");
CREATE INDEX "DailyReportInput_sectionType_reportDate_idx" ON "DailyReportInput"("sectionType", "reportDate");
CREATE INDEX "DailyReportInput_submittedById_reportDate_idx" ON "DailyReportInput"("submittedById", "reportDate");
CREATE INDEX "DailyReportInput_inputForUserId_reportDate_idx" ON "DailyReportInput"("inputForUserId", "reportDate");
CREATE INDEX "DailyReportInput_stationId_subsectionId_idx" ON "DailyReportInput"("stationId", "subsectionId");
CREATE INDEX "DailyReportRun_divisionId_reportDate_idx" ON "DailyReportRun"("divisionId", "reportDate");
CREATE INDEX "DailyReportRun_generatedById_createdAt_idx" ON "DailyReportRun"("generatedById", "createdAt");

-- AddForeignKey
ALTER TABLE "DailyReportInput" ADD CONSTRAINT "DailyReportInput_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReportInput" ADD CONSTRAINT "DailyReportInput_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyReportInput" ADD CONSTRAINT "DailyReportInput_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "Subsection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyReportInput" ADD CONSTRAINT "DailyReportInput_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReportInput" ADD CONSTRAINT "DailyReportInput_inputForUserId_fkey" FOREIGN KEY ("inputForUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyReportRun" ADD CONSTRAINT "DailyReportRun_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReportRun" ADD CONSTRAINT "DailyReportRun_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
