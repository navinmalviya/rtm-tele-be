/*
  Warnings:

  - Added the required column `divisionId` to the `Subsection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subsection" ADD COLUMN     "divisionId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Subsection" ADD CONSTRAINT "Subsection_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
