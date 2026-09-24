-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT';
ALTER TYPE "NotificationType" ADD VALUE 'ROLE_CHANGED';

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "task_id" DROP NOT NULL,
ALTER COLUMN "comment_id" DROP NOT NULL;
