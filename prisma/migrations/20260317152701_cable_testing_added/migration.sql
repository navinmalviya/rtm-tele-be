/*
  Warnings:

  - You are about to drop the column `location` on the `Joint` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CableJointType" AS ENUM ('NORMAL', 'EC');

-- AlterTable
ALTER TABLE "CableTestReport" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Joint" DROP COLUMN "location",
ADD COLUMN     "coordinatesX" TEXT,
ADD COLUMN     "coordinatesY" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "ecSocketId" TEXT,
ADD COLUMN     "jointDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "jointKm" DOUBLE PRECISION,
ADD COLUMN     "jointType" "CableJointType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "locationKM" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "side" "TrackSide";

-- CreateIndex
CREATE INDEX "Joint_cableId_jointDate_idx" ON "Joint"("cableId", "jointDate");

-- CreateIndex
CREATE INDEX "Joint_ecSocketId_idx" ON "Joint"("ecSocketId");

-- AddForeignKey
ALTER TABLE "Joint" ADD CONSTRAINT "Joint_ecSocketId_fkey" FOREIGN KEY ("ecSocketId") REFERENCES "EcSocket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Joint" ADD CONSTRAINT "Joint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
