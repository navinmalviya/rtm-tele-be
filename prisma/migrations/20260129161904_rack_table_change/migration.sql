/*
  Warnings:

  - Changed the type of `heightU` on the `Rack` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Rack" DROP COLUMN "heightU",
ADD COLUMN     "heightU" INTEGER NOT NULL;
