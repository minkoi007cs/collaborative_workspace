-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'WORKSPACE_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE 'OWNER_TRANSFERRED';
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_ROLE_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE 'BOARD_CREATED';
