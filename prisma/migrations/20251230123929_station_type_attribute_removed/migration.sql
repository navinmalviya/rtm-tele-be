/*
  Warnings:

  - You are about to drop the column `stationType` on the `Station` table. All the data in the column will be lost.
  - You are about to drop the `DeviceType` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `section` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subSection` to the `Station` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Station" DROP COLUMN "stationType",
ADD COLUMN     "section" TEXT NOT NULL,
ADD COLUMN     "subSection" TEXT NOT NULL;

-- DropTable
DROP TABLE "DeviceType";

-- DropEnum
DROP TYPE "DeviceMakers";

-- DropEnum
DROP TYPE "StationType";

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);
