-- Select specified performance exception handlers from the HR employee directory.
-- Existing user-based handler data is retained and copied when a linked employee exists.

ALTER TABLE "performance_cycles"
  ADD COLUMN IF NOT EXISTS "exception_handler_employee_id" TEXT;

UPDATE "performance_cycles" AS cycle
SET "exception_handler_employee_id" = user_record."employee_id"
FROM "users" AS user_record
WHERE cycle."exception_handler_employee_id" IS NULL
  AND cycle."exception_handler_user_id" = user_record."id"
  AND user_record."employee_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "performance_cycles_exception_handler_employee_id_idx"
  ON "performance_cycles"("exception_handler_employee_id");

DO $$
BEGIN
  ALTER TABLE "performance_cycles"
    ADD CONSTRAINT "performance_cycles_exception_handler_employee_id_fkey"
    FOREIGN KEY ("exception_handler_employee_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
