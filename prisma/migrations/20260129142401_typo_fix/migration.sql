/*
  Warnings:

  - You are about to drop the column `descriptoin` on the `Location` table. All the data in the column will be lost.
  - Added the required column `description` to the `Location` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Location" DROP COLUMN "descriptoin",
ADD COLUMN     "description" TEXT NOT NULL;
