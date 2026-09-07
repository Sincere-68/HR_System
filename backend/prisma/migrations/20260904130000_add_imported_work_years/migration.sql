-- Preserve the source total work years imported from external HR data without
-- inventing individual work-experience rows or date ranges.
ALTER TABLE "employees"
  ADD COLUMN "imported_work_years" DECIMAL(8,2),
  ADD COLUMN "imported_work_years_at" TIMESTAMP(3);
