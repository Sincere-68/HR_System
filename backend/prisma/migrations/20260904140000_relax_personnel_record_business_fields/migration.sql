-- Preserve incomplete external personnel data without removing ownership, foreign-key,
-- record-type, lifecycle-status, or audit constraints from personnel records.
ALTER TABLE "employment_periods"
  ALTER COLUMN "entry_date" DROP NOT NULL;

ALTER TABLE "employee_assignments"
  ALTER COLUMN "start_date" DROP NOT NULL;

ALTER TABLE "reporting_relationships"
  ALTER COLUMN "start_date" DROP NOT NULL;

ALTER TABLE "employee_identity_documents"
  ALTER COLUMN "document_number" DROP NOT NULL;

ALTER TABLE "employee_family_members"
  ALTER COLUMN "name" DROP NOT NULL;

ALTER TABLE "employee_education_experiences"
  ALTER COLUMN "school_name" DROP NOT NULL,
  ALTER COLUMN "education_level" DROP NOT NULL;

ALTER TABLE "employee_work_experiences"
  ALTER COLUMN "company_name" DROP NOT NULL,
  ALTER COLUMN "start_date" DROP NOT NULL;

ALTER TABLE "employee_appraisals"
  ALTER COLUMN "appraisal_period" DROP NOT NULL,
  ALTER COLUMN "appraisal_type" DROP NOT NULL;

ALTER TABLE "employee_training_records"
  ALTER COLUMN "training_name" DROP NOT NULL;

ALTER TABLE "employee_awards"
  ALTER COLUMN "award_name" DROP NOT NULL;

ALTER TABLE "employee_certificates"
  ALTER COLUMN "certificate_type" DROP NOT NULL,
  ALTER COLUMN "certificate_name" DROP NOT NULL;

ALTER TABLE "employee_project_experiences"
  ALTER COLUMN "project_name" DROP NOT NULL;

ALTER TABLE "employee_skills"
  ALTER COLUMN "skill_name" DROP NOT NULL;

ALTER TABLE "employee_language_abilities"
  ALTER COLUMN "language" DROP NOT NULL;

ALTER TABLE "employee_documents"
  ALTER COLUMN "document_type" DROP NOT NULL,
  ALTER COLUMN "document_name" DROP NOT NULL;

ALTER TABLE "employee_agreements"
  ALTER COLUMN "agreement_no" DROP NOT NULL,
  ALTER COLUMN "start_date" DROP NOT NULL;
