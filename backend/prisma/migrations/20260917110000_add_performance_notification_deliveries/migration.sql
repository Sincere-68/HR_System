-- Retain independent notification delivery outcomes for every performance
-- assessment and post-assessment workflow task assignee. This migration is
-- additive and does not alter existing instances, tasks, workflow actions or
-- performance results.

DO $$
BEGIN
  CREATE TYPE "PerformanceNotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PerformanceNotificationChannel" AS ENUM ('FEISHU_CARD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "performance_assessment_notification_deliveries" (
  "id" TEXT NOT NULL,
  "assessment_assignee_id" TEXT NOT NULL,
  "channel" "PerformanceNotificationChannel" NOT NULL,
  "status" "PerformanceNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "delivered_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_assessment_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "performance_workflow_notification_deliveries" (
  "id" TEXT NOT NULL,
  "workflow_assignee_id" TEXT NOT NULL,
  "channel" "PerformanceNotificationChannel" NOT NULL,
  "status" "PerformanceNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "delivered_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_workflow_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "performance_assessment_notification_deliveries_assessment_assignee_id_created_at_idx"
  ON "performance_assessment_notification_deliveries"("assessment_assignee_id", "created_at");
CREATE INDEX IF NOT EXISTS "performance_assessment_notification_deliveries_status_created_at_idx"
  ON "performance_assessment_notification_deliveries"("status", "created_at");
CREATE INDEX IF NOT EXISTS "performance_workflow_notification_deliveries_workflow_assignee_id_created_at_idx"
  ON "performance_workflow_notification_deliveries"("workflow_assignee_id", "created_at");
CREATE INDEX IF NOT EXISTS "performance_workflow_notification_deliveries_status_created_at_idx"
  ON "performance_workflow_notification_deliveries"("status", "created_at");

DO $$
BEGIN
  ALTER TABLE "performance_assessment_notification_deliveries"
    ADD CONSTRAINT "performance_assessment_notification_deliveries_assessment_assignee_id_fkey"
    FOREIGN KEY ("assessment_assignee_id") REFERENCES "performance_module_task_assignees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_workflow_notification_deliveries"
    ADD CONSTRAINT "performance_workflow_notification_deliveries_workflow_assignee_id_fkey"
    FOREIGN KEY ("workflow_assignee_id") REFERENCES "performance_workflow_task_assignees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
