-- DropForeignKey
ALTER TABLE "Subsection" DROP CONSTRAINT "Subsection_sectionId_fkey";

-- AlterTable
ALTER TABLE "Subsection" ALTER COLUMN "sectionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Subsection" ADD CONSTRAINT "Subsection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
