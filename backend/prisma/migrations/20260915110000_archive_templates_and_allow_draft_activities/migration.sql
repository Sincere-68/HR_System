-- Archive performance templates without physical deletion and allow activities
-- to be saved as drafts before a published template is assigned.

ALTER TABLE "performance_templates"
  ADD COLUMN IF NOT EXISTS "archived_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "archive_reason" TEXT;

CREATE INDEX IF NOT EXISTS "performance_templates_archived_by_id_idx"
  ON "performance_templates"("archived_by_id");

DO $$
BEGIN
  ALTER TABLE "performance_templates"
    ADD CONSTRAINT "performance_templates_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "performance_cycles"
  ALTER COLUMN "template_id" DROP NOT NULL,
  ALTER COLUMN "template_version_id" DROP NOT NULL;
