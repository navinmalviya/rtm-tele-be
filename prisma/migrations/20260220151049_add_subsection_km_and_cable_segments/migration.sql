/*
  Warnings:

  - The values [ADMIN,SR_DSTE_CO,DSTE,ADSTE,SSE_SECTIONAL,JE_SECTIONAL,TECHNICIAN,AUDIT_USER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `escalationLevel` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `failureReportedAt` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `lastEscalatedAt` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `slaBreachedAt` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `slaDueAt` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `sseInchargeById` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `sseInchargeRemark` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `sseInchargeRemarkAt` on the `Failure` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `equipmentId` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `remindBeforeDays` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `MaintenanceSchedule` table. All the data in the column will be lost.
  - You are about to drop the `MaintenanceOccurrence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskEscalationLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'TESTROOM', 'FIELD_ENGINEER', 'SSE_INCHARGE', 'TRC', 'VIEWER', 'SSE_ST_OFFICE', 'SSE_TECH', 'MAINTAINER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- DropForeignKey
ALTER TABLE "Failure" DROP CONSTRAINT "Failure_sseInchargeById_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceOccurrence" DROP CONSTRAINT "MaintenanceOccurrence_completedById_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceOccurrence" DROP CONSTRAINT "MaintenanceOccurrence_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceSchedule" DROP CONSTRAINT "MaintenanceSchedule_createdById_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceSchedule" DROP CONSTRAINT "MaintenanceSchedule_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceSchedule" DROP CONSTRAINT "MaintenanceSchedule_locationId_fkey";

-- DropForeignKey
ALTER TABLE "TaskEscalationLog" DROP CONSTRAINT "TaskEscalationLog_escalatedById_fkey";

-- DropForeignKey
ALTER TABLE "TaskEscalationLog" DROP CONSTRAINT "TaskEscalationLog_taskId_fkey";

-- AlterTable
ALTER TABLE "Failure" DROP COLUMN "escalationLevel",
DROP COLUMN "failureReportedAt",
DROP COLUMN "lastEscalatedAt",
DROP COLUMN "slaBreachedAt",
DROP COLUMN "slaDueAt",
DROP COLUMN "sseInchargeById",
DROP COLUMN "sseInchargeRemark",
DROP COLUMN "sseInchargeRemarkAt";

-- AlterTable
ALTER TABLE "MaintenanceSchedule" DROP COLUMN "createdAt",
DROP COLUMN "createdById",
DROP COLUMN "description",
DROP COLUMN "equipmentId",
DROP COLUMN "locationId",
DROP COLUMN "remindBeforeDays",
DROP COLUMN "status",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Subsection" ADD COLUMN     "endKm" DOUBLE PRECISION,
ADD COLUMN     "startKm" DOUBLE PRECISION;

-- DropTable
DROP TABLE "MaintenanceOccurrence";

-- DropTable
DROP TABLE "TaskEscalationLog";

-- DropEnum
DROP TYPE "MaintenanceStatus";

-- DropEnum
DROP TYPE "ScheduleStatus";

-- CreateTable
CREATE TABLE "CableSideSegment" (
    "id" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,
    "fromKm" DOUBLE PRECISION NOT NULL,
    "toKm" DOUBLE PRECISION NOT NULL,
    "side" "TrackSide" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CableSideSegment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CableSideSegment" ADD CONSTRAINT "CableSideSegment_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
