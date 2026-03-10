-- CreateEnum
CREATE TYPE "TnpType" AS ENUM ('FURNITURE', 'TOOLS', 'METERS', 'ELECTRICAL', 'ELECTRONICS', 'CUTLARY', 'SAFETY', 'RACKS', 'LINEN');

-- CreateTable
CREATE TABLE "TnpItem" (
    "id" TEXT NOT NULL,
    "tnpNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "TnpType" NOT NULL,
    "stationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TnpItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TnpItem_tnpNumber_key" ON "TnpItem"("tnpNumber");

-- AddForeignKey
ALTER TABLE "TnpItem" ADD CONSTRAINT "TnpItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TnpItem" ADD CONSTRAINT "TnpItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
