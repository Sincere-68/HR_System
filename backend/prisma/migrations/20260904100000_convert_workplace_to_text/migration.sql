-- Preserve existing workplace labels before replacing the obsolete directory foreign keys.
ALTER TABLE "employee_assignments" ADD COLUMN "workplace_name" VARCHAR(191);
ALTER TABLE "offers" ADD COLUMN "workplace_name" VARCHAR(191);

UPDATE "employee_assignments" AS assignment
SET "workplace_name" = workplace."name"
FROM "workplaces" AS workplace
WHERE assignment."workplace_id" = workplace."id";

UPDATE "offers" AS offer
SET "workplace_name" = workplace."name"
FROM "workplaces" AS workplace
WHERE offer."workplace_id" = workplace."id";

ALTER TABLE "employee_assignments" DROP CONSTRAINT "employee_assignments_workplace_id_fkey";
ALTER TABLE "offers" DROP CONSTRAINT "offers_workplace_id_fkey";
ALTER TABLE "employee_assignments" DROP COLUMN "workplace_id";
ALTER TABLE "offers" DROP COLUMN "workplace_id";
