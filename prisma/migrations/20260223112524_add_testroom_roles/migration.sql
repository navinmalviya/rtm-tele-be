-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'SR_DSTE_CO';
ALTER TYPE "UserRole" ADD VALUE 'DSTE';
ALTER TYPE "UserRole" ADD VALUE 'ADSTE';
ALTER TYPE "UserRole" ADD VALUE 'SSE_SECTIONAL';
ALTER TYPE "UserRole" ADD VALUE 'JE_SECTIONAL';
ALTER TYPE "UserRole" ADD VALUE 'TECHNICIAN';
ALTER TYPE "UserRole" ADD VALUE 'AUDIT_USER';
