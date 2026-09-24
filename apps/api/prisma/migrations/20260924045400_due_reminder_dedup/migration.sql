ALTER TYPE "NotificationType" ADD VALUE 'DUE_SOON';

ALTER TABLE "notifications" ALTER COLUMN "actor_id" DROP NOT NULL;
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" VARCHAR(200);

CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
