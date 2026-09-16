-- Allow performance task assignees to be employees without internal system users.
-- Existing user-based assignees are preserved and backfilled with their linked employee.

ALTER TABLE "performance_module_task_assignees"
  ADD COLUMN IF NOT EXISTS "employee_id" TEXT;

UPDATE "performance_module_task_assignees" AS assignee
SET "employee_id" = user_record."employee_id"
FROM "users" AS user_record
WHERE assignee."employee_id" IS NULL
  AND assignee."user_id" = user_record."id"
  AND user_record."employee_id" IS NOT NULL;

ALTER TABLE "performance_module_task_assignees"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ALTER COLUMN "account_snapshot" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "performance_module_task_assignees_task_id_employee_id_key"
  ON "performance_module_task_assignees"("task_id", "employee_id")
  WHERE "employee_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "performance_module_task_assignees_employee_id_status_idx"
  ON "performance_module_task_assignees"("employee_id", "status");

DO $$
BEGIN
  ALTER TABLE "performance_module_task_assignees"
    ADD CONSTRAINT "performance_module_task_assignees_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
