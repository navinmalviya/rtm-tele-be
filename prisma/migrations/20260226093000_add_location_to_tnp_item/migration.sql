-- AlterTable
ALTER TABLE "TnpItem"
ADD COLUMN "locationId" TEXT;

-- CreateIndex
CREATE INDEX "TnpItem_locationId_idx" ON "TnpItem"("locationId");

-- AddForeignKey
ALTER TABLE "TnpItem"
ADD CONSTRAINT "TnpItem_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
