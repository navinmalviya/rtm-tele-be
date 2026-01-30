/*
  Warnings:

  - You are about to drop the column `assetTag` on the `Equipment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Equipment_assetTag_key";

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "assetTag",
ADD COLUMN     "DateOfLastMaintenace" TIMESTAMP(3),
ADD COLUMN     "mapX" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "mapY" DOUBLE PRECISION NOT NULL DEFAULT 0;
