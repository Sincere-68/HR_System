-- Additive storage for Feishu-authenticated performance inbox entry.
-- State hashes and delivery history are retained without storing open_id,
-- OAuth codes, user access tokens, or task payloads.

DO $$
BEGIN
  CREATE TYPE "PerformanceFeishuTaskSessionStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "performance_feishu_task_sessions" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "cycle_id" TEXT NOT NULL,
  "state_hash" TEXT NOT NULL,
  "status" "PerformanceFeishuTaskSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_feishu_task_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_feishu_task_sessions_state_hash_key" UNIQUE ("state_hash")
);

CREATE TABLE IF NOT EXISTS "performance_feishu_task_inbox_deliveries" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "cycle_id" TEXT NOT NULL,
  "session_id" TEXT,
  "message_id" TEXT,
  "status" "PerformanceNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "delivered_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_feishu_task_inbox_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "performance_feishu_task_sessions_employee_id_status_expires_at_idx"
  ON "performance_feishu_task_sessions"("employee_id", "status", "expires_at");
CREATE INDEX IF NOT EXISTS "performance_feishu_task_sessions_cycle_id_employee_id_status_idx"
  ON "performance_feishu_task_sessions"("cycle_id", "employee_id", "status");
CREATE INDEX IF NOT EXISTS "performance_feishu_task_inbox_deliveries_employee_id_cycle_id_created_at_idx"
  ON "performance_feishu_task_inbox_deliveries"("employee_id", "cycle_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "performance_feishu_task_inbox_deliveries_employee_id_cycle_id_key"
  ON "performance_feishu_task_inbox_deliveries"("employee_id", "cycle_id");
CREATE INDEX IF NOT EXISTS "performance_feishu_task_inbox_deliveries_status_created_at_idx"
  ON "performance_feishu_task_inbox_deliveries"("status", "created_at");

DO $$
BEGIN
  ALTER TABLE "performance_feishu_task_sessions"
    ADD CONSTRAINT "performance_feishu_task_sessions_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_feishu_task_sessions"
    ADD CONSTRAINT "performance_feishu_task_sessions_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_feishu_task_inbox_deliveries"
    ADD CONSTRAINT "performance_feishu_task_inbox_deliveries_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_feishu_task_inbox_deliveries"
    ADD CONSTRAINT "performance_feishu_task_inbox_deliveries_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_feishu_task_inbox_deliveries"
    ADD CONSTRAINT "performance_feishu_task_inbox_deliveries_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "performance_feishu_task_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
