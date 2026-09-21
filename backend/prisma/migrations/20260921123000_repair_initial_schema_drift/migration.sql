-- Earlier revisions incorrectly appended these changes to the already-deployed
-- initial migration. This migration is additive so existing PostgreSQL data is
-- preserved while the schema is brought up to date.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "feishu_open_id" TEXT,
  ADD COLUMN IF NOT EXISTS "feishu_open_id_synced_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_feishu_open_id_key"
  ON "users"("feishu_open_id");

ALTER TABLE "performance_instances"
  ADD COLUMN IF NOT EXISTS "employee_amount_base_id" TEXT,
  ADD COLUMN IF NOT EXISTS "employee_amount_base_snapshot" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "employee_amount_base_version_no" INTEGER;

CREATE TABLE IF NOT EXISTS "employee_performance_amount_bases" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "version_no" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "replaced_at" TIMESTAMP(3),
  "changed_by_id" TEXT NOT NULL,
  "change_reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "employee_performance_amount_bases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_performance_amount_bases_employee_id_version_no_key"
  ON "employee_performance_amount_bases"("employee_id", "version_no");

CREATE INDEX IF NOT EXISTS "employee_performance_amount_bases_employee_id_effective_at_idx"
  ON "employee_performance_amount_bases"("employee_id", "effective_at");

CREATE INDEX IF NOT EXISTS "employee_performance_amount_bases_changed_by_id_created_at_idx"
  ON "employee_performance_amount_bases"("changed_by_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'performance_instances_employee_amount_base_id_fkey'
  ) THEN
    ALTER TABLE "performance_instances"
      ADD CONSTRAINT "performance_instances_employee_amount_base_id_fkey"
      FOREIGN KEY ("employee_amount_base_id")
      REFERENCES "employee_performance_amount_bases"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_performance_amount_bases_employee_id_fkey'
  ) THEN
    ALTER TABLE "employee_performance_amount_bases"
      ADD CONSTRAINT "employee_performance_amount_bases_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_performance_amount_bases_changed_by_id_fkey'
  ) THEN
    ALTER TABLE "employee_performance_amount_bases"
      ADD CONSTRAINT "employee_performance_amount_bases_changed_by_id_fkey"
      FOREIGN KEY ("changed_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
