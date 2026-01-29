/*
  Warnings:

  - Added the required column `heightU` to the `Rack` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Rack` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RackType" AS ENUM ('WALL_MOUNTED', 'FLOOR_STANDING', 'OUTDOOR_CABINET', 'BATTERY_STAND');

-- AlterTable
ALTER TABLE "Rack" ADD COLUMN     "heightU" TEXT NOT NULL,
ADD COLUMN     "type" "RackType" NOT NULL;
