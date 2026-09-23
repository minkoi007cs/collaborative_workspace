CREATE TABLE "infrastructure_probe" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "infrastructure_probe_pkey" PRIMARY KEY ("id")
);
