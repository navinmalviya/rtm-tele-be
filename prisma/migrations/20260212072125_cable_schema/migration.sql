/*
  Warnings:

  - Added the required column `length` to the `Cable` table without a default value. This is not possible if the table is not empty.
  - Added the required column `side` to the `Cable` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subType` to the `Cable` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Cable` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Cable` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TrackSide" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "CableType" AS ENUM ('PIJF', 'OFC', 'SWITCHBOARD_CABLE');

-- CreateEnum
CREATE TYPE "CableSubType" AS ENUM ('PAIR_10', 'PAIR_20', 'PAIR_50', 'QUAD_6', 'CAT_6', 'OFC_48', 'OFC_24', 'OFC_6');

-- AlterTable
ALTER TABLE "Cable" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateOfCommissioning" TIMESTAMP(3),
ADD COLUMN     "fiberCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "length" TEXT NOT NULL,
ADD COLUMN     "pairCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "side" "TrackSide" NOT NULL,
ADD COLUMN     "subType" "CableSubType" NOT NULL,
ADD COLUMN     "tubeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "CableType" NOT NULL;

-- CreateTable
CREATE TABLE "CopperPair" (
    "id" TEXT NOT NULL,
    "quadNo" INTEGER NOT NULL,
    "quadColor" TEXT,
    "pairNo" INTEGER NOT NULL,
    "pairColor" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,

    CONSTRAINT "CopperPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fiber" (
    "id" TEXT NOT NULL,
    "tubeNo" INTEGER NOT NULL,
    "tubeColor" TEXT NOT NULL,
    "fiberNo" INTEGER NOT NULL,
    "fiberColor" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,

    CONSTRAINT "Fiber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcSocket" (
    "id" TEXT NOT NULL,
    "poleKm" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcSocket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcTesting" (
    "id" TEXT NOT NULL,
    "testedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPainted" BOOLEAN NOT NULL DEFAULT false,
    "isPlatformProper" BOOLEAN NOT NULL DEFAULT false,
    "communication" BOOLEAN NOT NULL DEFAULT true,
    "socketPoleHeight" TEXT NOT NULL,
    "remarks" TEXT,
    "testedById" TEXT,
    "testWithId" TEXT,
    "socketId" TEXT NOT NULL,

    CONSTRAINT "EcTesting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CircuitToPairs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CircuitToPairs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CircuitToFibers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CircuitToFibers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CircuitToPairs_B_index" ON "_CircuitToPairs"("B");

-- CreateIndex
CREATE INDEX "_CircuitToFibers_B_index" ON "_CircuitToFibers"("B");

-- AddForeignKey
ALTER TABLE "CopperPair" ADD CONSTRAINT "CopperPair_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiber" ADD CONSTRAINT "Fiber_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcSocket" ADD CONSTRAINT "EcSocket_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcTesting" ADD CONSTRAINT "EcTesting_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcTesting" ADD CONSTRAINT "EcTesting_testWithId_fkey" FOREIGN KEY ("testWithId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcTesting" ADD CONSTRAINT "EcTesting_socketId_fkey" FOREIGN KEY ("socketId") REFERENCES "EcSocket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CircuitToPairs" ADD CONSTRAINT "_CircuitToPairs_A_fkey" FOREIGN KEY ("A") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CircuitToPairs" ADD CONSTRAINT "_CircuitToPairs_B_fkey" FOREIGN KEY ("B") REFERENCES "CopperPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CircuitToFibers" ADD CONSTRAINT "_CircuitToFibers_A_fkey" FOREIGN KEY ("A") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CircuitToFibers" ADD CONSTRAINT "_CircuitToFibers_B_fkey" FOREIGN KEY ("B") REFERENCES "Fiber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
