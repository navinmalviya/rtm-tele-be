/*
  Warnings:

  - The values [PRS] on the enum `FailureType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FailureType_new" AS ENUM ('AXLE_COUTER', 'DATA_LOGGER', 'VHF', 'GPS_CLOCK', 'BLOCK', 'SECTION_CONTROL', 'TPC_CONTROL', 'SI_CONTROL', 'UTN', 'FOIS', 'AUTO_PHONE', 'RAILNET', 'CMS_SERVER', 'CGDB_BOARD', 'PA_SYSTEM', 'FARE_TERMINAL', 'FCT_STD_PHONE', 'MISC');
ALTER TABLE "Failure" ALTER COLUMN "type" TYPE "FailureType_new" USING ("type"::text::"FailureType_new");
ALTER TYPE "FailureType" RENAME TO "FailureType_old";
ALTER TYPE "FailureType_new" RENAME TO "FailureType";
DROP TYPE "public"."FailureType_old";
COMMIT;
