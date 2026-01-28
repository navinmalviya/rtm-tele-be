/*
  Warnings:

  - Added the required column `createdById` to the `Subsection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subsection" ADD COLUMN     "createdById" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Subsection" ADD CONSTRAINT "Subsection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
