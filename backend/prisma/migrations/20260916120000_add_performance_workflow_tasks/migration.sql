-- Separate post-assessment workflow execution from scored performance modules.
-- This migration is additive and preserves all historical performance results.

DO $$
BEGIN
  CREATE TYPE "PerformanceWorkflowStepType" AS ENUM ('REVIEW', 'CONFIRMATION', 'APPROVAL', 'HR_ARCHIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PerformanceWorkflowRejectionStrategy" AS ENUM ('END', 'RETURN_PREVIOUS', 'RETURN_TO_STEP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PerformanceWorkflowAction" AS ENUM ('APPROVE', 'REJECT', 'CONFIRM', 'ARCHIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PerformanceWorkflowActionSource" AS ENUM ('WEB', 'FEISHU');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "performance_instances"
  ADD COLUMN IF NOT EXISTS "assessment_status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "assessment_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "current_workflow_order" INTEGER,
  ADD COLUMN IF NOT EXISTS "workflow_completed_at" TIMESTAMP(3);

ALTER TABLE "performance_module_task_assignees"
  ADD COLUMN IF NOT EXISTS "card_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "card_issued_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "card_consumed_at" TIMESTAMP(3);

-- Historical instances had no post-assessment workflow. Preserve their existing
-- lifecycle semantics by treating a completed instance as a completed assessment.
UPDATE "performance_instances"
SET "assessment_status" = CASE
  WHEN "status" = 'COMPLETED' THEN 'COMPLETED'::"ProcessStatus"
  WHEN "status" = 'IN_PROGRESS' THEN 'IN_PROGRESS'::"ProcessStatus"
  WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"ProcessStatus"
  WHEN "status" = 'REJECTED' THEN 'REJECTED'::"ProcessStatus"
  ELSE "assessment_status"
END
WHERE "assessment_status" = 'DRAFT';

CREATE TABLE IF NOT EXISTS "performance_workflow_tasks" (
  "id" TEXT NOT NULL,
  "instance_id" TEXT NOT NULL,
  "step_id" TEXT NOT NULL,
  "step_order" INTEGER NOT NULL,
  "attempt_no" INTEGER NOT NULL DEFAULT 1,
  "step_name" TEXT NOT NULL,
  "step_type" "PerformanceWorkflowStepType" NOT NULL,
  "step_snapshot" JSONB NOT NULL,
  "rejection_strategy" "PerformanceWorkflowRejectionStrategy",
  "rejection_target_step_id" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "executor_name_snapshot" TEXT,
  "executor_resolved_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_workflow_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_workflow_tasks_instance_id_step_order_attempt_no_key" UNIQUE ("instance_id", "step_order", "attempt_no")
);

CREATE TABLE IF NOT EXISTS "performance_workflow_task_assignees" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "user_id" TEXT,
  "display_name_snapshot" TEXT NOT NULL,
  "account_snapshot" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "card_token_hash" TEXT,
  "card_issued_at" TIMESTAMP(3),
  "card_consumed_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_workflow_task_assignees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_workflow_task_assignees_task_id_employee_id_key" UNIQUE ("task_id", "employee_id")
);

CREATE TABLE IF NOT EXISTS "performance_workflow_task_actions" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "assignee_id" TEXT NOT NULL,
  "action" "PerformanceWorkflowAction" NOT NULL,
  "source" "PerformanceWorkflowActionSource" NOT NULL,
  "comment" TEXT,
  "actor_user_id" TEXT,
  "callback_event_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "performance_workflow_task_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "performance_module_task_assignees_card_token_hash_key"
  ON "performance_module_task_assignees"("card_token_hash")
  WHERE "card_token_hash" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "performance_workflow_task_assignees_card_token_hash_key"
  ON "performance_workflow_task_assignees"("card_token_hash")
  WHERE "card_token_hash" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "performance_workflow_task_actions_callback_event_id_key"
  ON "performance_workflow_task_actions"("callback_event_id")
  WHERE "callback_event_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "performance_instances_assessment_status_idx"
  ON "performance_instances"("assessment_status");
CREATE INDEX IF NOT EXISTS "performance_instances_current_workflow_order_idx"
  ON "performance_instances"("current_workflow_order");
CREATE INDEX IF NOT EXISTS "performance_workflow_tasks_instance_id_status_idx"
  ON "performance_workflow_tasks"("instance_id", "status");
CREATE INDEX IF NOT EXISTS "performance_workflow_tasks_status_step_type_idx"
  ON "performance_workflow_tasks"("status", "step_type");
CREATE INDEX IF NOT EXISTS "performance_workflow_task_assignees_employee_id_status_idx"
  ON "performance_workflow_task_assignees"("employee_id", "status");
CREATE INDEX IF NOT EXISTS "performance_workflow_task_assignees_user_id_status_idx"
  ON "performance_workflow_task_assignees"("user_id", "status");
CREATE INDEX IF NOT EXISTS "performance_workflow_task_assignees_task_id_status_idx"
  ON "performance_workflow_task_assignees"("task_id", "status");
CREATE INDEX IF NOT EXISTS "performance_workflow_task_actions_task_id_created_at_idx"
  ON "performance_workflow_task_actions"("task_id", "created_at");
CREATE INDEX IF NOT EXISTS "performance_workflow_task_actions_assignee_id_created_at_idx"
  ON "performance_workflow_task_actions"("assignee_id", "created_at");

DO $$
BEGIN
  ALTER TABLE "performance_workflow_tasks"
    ADD CONSTRAINT "performance_workflow_tasks_instance_id_fkey"
    FOREIGN KEY ("instance_id") REFERENCES "performance_instances"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_workflow_task_assignees"
    ADD CONSTRAINT "performance_workflow_task_assignees_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "performance_workflow_tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_workflow_task_assignees"
    ADD CONSTRAINT "performance_workflow_task_assignees_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_workflow_task_assignees"
    ADD CONSTRAINT "performance_workflow_task_assignees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_workflow_task_actions"
    ADD CONSTRAINT "performance_workflow_task_actions_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "performance_workflow_tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_workflow_task_actions"
    ADD CONSTRAINT "performance_workflow_task_actions_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "performance_workflow_task_assignees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_workflow_task_actions"
    ADD CONSTRAINT "performance_workflow_task_actions_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
