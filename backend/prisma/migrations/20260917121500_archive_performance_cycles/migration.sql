-- Archive performance activities without deleting their instances, tasks, results, or audit history.

ALTER TABLE "performance_cycles"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "archive_reason" TEXT;

CREATE INDEX IF NOT EXISTS "performance_cycles_archived_by_id_idx"
  ON "performance_cycles"("archived_by_id");

DO $$
BEGIN
  ALTER TABLE "performance_cycles"
    ADD CONSTRAINT "performance_cycles_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
