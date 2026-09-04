-- Fields maintained by the employee editor. All new columns are nullable so
-- existing employee records remain valid until the values are collected.
ALTER TABLE "employees"
  ADD COLUMN "work_start_date" DATE,
  ADD COLUMN "birthday_preference" VARCHAR(16),
  ADD COLUMN "lunar_birth_date" DATE,
  ADD COLUMN "full_time_duty_description" TEXT,
  ADD COLUMN "part_time_position_name" VARCHAR(191),
  ADD COLUMN "part_time_hourly_rate" DECIMAL(12,2),
  ADD COLUMN "has_company_equity" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "employee_assignments"
  ADD COLUMN "confirmation_date" DATE,
  ADD COLUMN "trial_post_end_date" DATE,
  ADD COLUMN "movement_type_id" TEXT,
  ADD COLUMN "change_description" TEXT;

CREATE INDEX "employee_assignments_movement_type_id_idx"
  ON "employee_assignments"("movement_type_id");

ALTER TABLE "employee_assignments"
  ADD CONSTRAINT "employee_assignments_movement_type_id_fkey"
  FOREIGN KEY ("movement_type_id") REFERENCES "movement_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
