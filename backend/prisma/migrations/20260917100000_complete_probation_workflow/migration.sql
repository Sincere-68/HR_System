-- Persist the kind of probation evaluation so the reviewing queue can show
-- the same business name that initiated the workflow.
ALTER TABLE "probation_records"
ADD COLUMN "evaluation_type" VARCHAR(32);

-- Historical employment records may legitimately have many closed rows. The
-- original composite uniqueness constraint allowed only one `false` row and
-- blocked a second regularization for the same employee.
DROP INDEX IF EXISTS "employment_records_employee_id_current_flag_key";

CREATE UNIQUE INDEX "employment_records_current_employee_key"
ON "employment_records" ("employee_id")
WHERE "current_flag" IS TRUE;

-- A single employment period must not have competing active probation flows.
-- Completed, cancelled, and archived records remain available as history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "probation_records"
    WHERE "employment_period_id" IS NOT NULL
      AND "archived_at" IS NULL
      AND "status" IN ('DRAFT', 'IN_PROGRESS', 'PENDING', 'APPROVED')
    GROUP BY "employment_period_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot apply probation workflow migration: duplicate active probation records exist for one employment period.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "probation_records_open_employment_period_key"
ON "probation_records" ("employment_period_id")
WHERE "employment_period_id" IS NOT NULL
  AND "archived_at" IS NULL
  AND "status" IN ('DRAFT', 'IN_PROGRESS', 'PENDING', 'APPROVED');

-- A retry or simultaneous click must not create two open regularization
-- approval requests for the same probation record.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "approval_requests"
    WHERE "business_type" = 'PROBATION_REGULARIZATION'
      AND "business_id" IS NOT NULL
      AND "archived_at" IS NULL
      AND "status" IN ('PENDING', 'IN_PROGRESS')
    GROUP BY "business_type", "business_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot apply probation workflow migration: duplicate active probation approval requests exist.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "approval_requests_open_probation_regularization_key"
ON "approval_requests" ("business_type", "business_id")
WHERE "business_type" = 'PROBATION_REGULARIZATION'
  AND "business_id" IS NOT NULL
  AND "archived_at" IS NULL
  AND "status" IN ('PENDING', 'IN_PROGRESS');
