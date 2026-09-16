-- Persist employee performance activity configuration without changing historical
-- cycle, instance, task, result, or amount-snapshot data.

DO $$
BEGIN
  CREATE TYPE "PerformanceCyclePeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PerformanceExceptionHandlerType" AS ENUM ('SPECIFIED_USER', 'DIRECT_MANAGER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "performance_cycles"
  ADD COLUMN IF NOT EXISTS "organization_id" TEXT,
  ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "linked_level" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "year" INTEGER,
  ADD COLUMN IF NOT EXISTS "period_type" "PerformanceCyclePeriodType",
  ADD COLUMN IF NOT EXISTS "exception_handler_type" "PerformanceExceptionHandlerType",
  ADD COLUMN IF NOT EXISTS "exception_handler_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "lock_relation" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "performance_cycles_organization_id_status_idx"
  ON "performance_cycles"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "performance_cycles_exception_handler_user_id_idx"
  ON "performance_cycles"("exception_handler_user_id");

DO $$
BEGIN
  ALTER TABLE "performance_cycles"
    ADD CONSTRAINT "performance_cycles_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "performance_cycles"
    ADD CONSTRAINT "performance_cycles_exception_handler_user_id_fkey"
    FOREIGN KEY ("exception_handler_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
