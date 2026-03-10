/*
  Warnings:

  - The values [FIELD_ENGINEER,SSE_INCHARGE,SSE_ST_OFFICE,MAINTAINER,SR_DSTE_CO,DSTE,ADSTE,SSE_SECTIONAL,JE_SECTIONAL,AUDIT_USER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TESTROOM', 'SSE_TELE_INCHARGE', 'JE_SSE_TELE_SECTIONAL', 'TECHNICIAN', 'TRC', 'VIEWER', 'SSE_SNT_OFFICE', 'SSE_TECH');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- DropIndex
DROP INDEX "MaintenanceSchedule_supervisorId_idx";

-- DropIndex
DROP INDEX "Station_supervisorId_idx";

-- DropIndex
DROP INDEX "Subsection_supervisorId_idx";

-- DropIndex
DROP INDEX "TaskHistory_actorId_idx";

-- DropIndex
DROP INDEX "TaskHistory_taskId_createdAt_idx";

-- DropIndex
DROP INDEX "TnpItem_locationId_idx";
