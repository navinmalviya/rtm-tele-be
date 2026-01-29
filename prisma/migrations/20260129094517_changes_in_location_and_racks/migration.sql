/*
  Warnings:

  - Added the required column `descriptoin` to the `Location` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Rack` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "descriptoin" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Rack" ADD COLUMN     "description" TEXT NOT NULL;
