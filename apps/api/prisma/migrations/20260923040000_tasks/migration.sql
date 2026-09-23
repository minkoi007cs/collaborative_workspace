CREATE TYPE "TaskPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

ALTER TABLE "columns" ADD CONSTRAINT "columns_id_board_id_key" UNIQUE ("id", "board_id");

CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "rank" VARCHAR(18) NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NONE',
    "due_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_assignees" (
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id", "user_id")
);

CREATE TABLE "labels" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_labels" (
    "task_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    CONSTRAINT "task_labels_pkey" PRIMARY KEY ("task_id", "label_id")
);

CREATE UNIQUE INDEX "tasks_column_id_rank_key" ON "tasks"("column_id", "rank");
CREATE INDEX "tasks_board_id_archived_at_idx" ON "tasks"("board_id", "archived_at");
CREATE INDEX "tasks_column_id_rank_idx" ON "tasks"("column_id", "rank");
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");
CREATE UNIQUE INDEX "labels_project_id_name_key" ON "labels"("project_id", "name");
CREATE INDEX "task_labels_label_id_idx" ON "task_labels"("label_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_id_board_id_fkey" FOREIGN KEY ("column_id", "board_id") REFERENCES "columns"("id", "board_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "labels" ADD CONSTRAINT "labels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
