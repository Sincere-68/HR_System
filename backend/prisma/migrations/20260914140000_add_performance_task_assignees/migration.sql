-- Add explicit task participants for single- and multiple-person performance modules.
-- Existing task-level executor snapshots remain intact for historical compatibility.

DO $$
BEGIN
  CREATE TYPE "PerformanceExecutionMode" AS ENUM ('SINGLE', 'MULTIPLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "performance_module_tasks"
  ADD COLUMN IF NOT EXISTS "execution_mode" "PerformanceExecutionMode"
  NOT NULL DEFAULT 'SINGLE';

CREATE TABLE IF NOT EXISTS "performance_module_task_assignees" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "display_name_snapshot" TEXT NOT NULL,
  "account_snapshot" TEXT NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "submission" JSONB,
  "score" DECIMAL(10,4),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_module_task_assignees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_module_task_assignees_task_id_user_id_key" UNIQUE ("task_id", "user_id")
);


-- Give every historical task with a retained executor one equivalent participant.
-- Composite textual IDs are stable and valid for this pre-existing data repair.
INSERT INTO "performance_module_task_assignees" (
  "id", "task_id", "user_id", "display_name_snapshot", "account_snapshot",
  "status", "submission", "score", "completed_at", "created_at", "updated_at"
)
SELECT
  task."id" || ':assignee:' || task."executor_user_id",
  task."id",
  task."executor_user_id",
  COALESCE(task."executor_name_snapshot", executor."display_name", task."executor_user_id"),
  COALESCE(task."executor_account_snapshot", executor."username", task."executor_user_id"),
  CASE
    WHEN task."status" = 'COMPLETED' THEN 'COMPLETED'::"TaskStatus"
    WHEN task."status" = 'CANCELLED' THEN 'CANCELLED'::"TaskStatus"
    WHEN task."status" = 'IN_PROGRESS' THEN 'IN_PROGRESS'::"TaskStatus"
    ELSE 'PENDING'::"TaskStatus"
  END,
  task."submission",
  task."module_score",
  task."completed_at",
  task."created_at",
  task."updated_at"
FROM "performance_module_tasks" AS task
LEFT JOIN "users" AS executor ON executor."id" = task."executor_user_id"
WHERE task."executor_user_id" IS NOT NULL
ON CONFLICT ("task_id", "user_id") DO NOTHING;

CREATE INDEX IF NOT EXISTS "performance_module_task_assignees_user_id_status_idx"
  ON "performance_module_task_assignees"("user_id", "status");

CREATE INDEX IF NOT EXISTS "performance_module_task_assignees_task_id_status_idx"
  ON "performance_module_task_assignees"("task_id", "status");

DO $$
BEGIN
  ALTER TABLE "performance_module_task_assignees"
    ADD CONSTRAINT "performance_module_task_assignees_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "performance_module_tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_module_task_assignees"
    ADD CONSTRAINT "performance_module_task_assignees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
