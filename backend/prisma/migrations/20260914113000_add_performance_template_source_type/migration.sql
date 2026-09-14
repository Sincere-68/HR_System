-- Repair an existing PostgreSQL deployment that predates manual performance templates.
-- Existing template versions remain Markdown-origin versions; no source content is changed.

DO $$
BEGIN
  CREATE TYPE "PerformanceTemplateSourceType" AS ENUM ('MARKDOWN', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "performance_template_versions"
  ADD COLUMN IF NOT EXISTS "source_type" "PerformanceTemplateSourceType"
  NOT NULL DEFAULT 'MARKDOWN';

ALTER TABLE "performance_template_versions"
  ALTER COLUMN "source_markdown" DROP NOT NULL;
