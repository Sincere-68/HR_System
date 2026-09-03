-- Add confirmed Candidate and Offer snapshots.
-- This migration is additive: existing Candidate/Offer rows remain valid and all
-- new columns on existing tables are nullable. Review against a backed-up MySQL
-- database before applying; this file is intentionally not executed here.

-- AlterTable: safe nullable Candidate fields.
ALTER TABLE `candidates`
  ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'UNDISCLOSED') NULL,
  ADD COLUMN `birth_date` DATE NULL,
  ADD COLUMN `work_start_date` DATE NULL;

-- AlterTable: safe nullable Offer snapshots.
ALTER TABLE `offers`
  ADD COLUMN `direct_manager_employee_id` VARCHAR(191) NULL,
  ADD COLUMN `job_level` ENUM('S1','S2','S3','S4','S5','S6','S7','E1','E2','E3','E4','E5','E6','E7','T1','T2','T3','T4','T5','T6','T7','M1','M2','M3','M4','M5','M6','M7') NULL,
  ADD COLUMN `employee_level` ENUM('STAFF','SUPERVISOR','MANAGER','DIRECTOR','PRESIDENT','EXPERT') NULL,
  ADD COLUMN `personnel_category` ENUM('TALENT_PROGRAM','NON_TALENT_PROGRAM') NULL,
  ADD COLUMN `work_arrangement` ENUM('PART_TIME','LABOR_DISPATCH','CONTRACT_EMPLOYMENT','LABOR_EMPLOYMENT','INTERN','RETIREE_REEMPLOYMENT') NULL,
  ADD COLUMN `employing_company_id` VARCHAR(191) NULL,
  ADD COLUMN `agreement_type` ENUM('LABOR_CONTRACT','LABOR_SERVICE_CONTRACT','INTERNSHIP_AGREEMENT','OTHER','NON_COMPETE_AGREEMENT','RETIREE_REEMPLOYMENT_AGREEMENT','NON_FULL_TIME_EMPLOYMENT_CONTRACT','SPECIAL_AGREEMENT','PART_TIME_SERVICE_AGREEMENT') NULL,
  ADD COLUMN `contract_term_type` VARCHAR(32) NULL,
  ADD COLUMN `contract_months` INTEGER NULL,
  ADD COLUMN `contract_end_date` DATE NULL,
  ADD COLUMN `is_separately_signed` BOOLEAN NULL;

-- CreateTable
CREATE TABLE `candidate_identity_documents` (
  `id` VARCHAR(191) NOT NULL,
  `candidate_id` VARCHAR(191) NOT NULL,
  `document_type` ENUM('NATIONAL_ID','PASSPORT','HK_MACAO_PERMIT','TAIWAN_PERMIT','MILITARY_ID','ARMED_POLICE_OFFICER_ID','HK_MACAO_ID','FOREIGN_PASSPORT','HK_PERMANENT_ID','TAIWAN_ID','MACAO_PERMANENT_ID','FOREIGN_PERMANENT_RESIDENCE_ID','MACAO_NON_PERMANENT_ID','HK_ID','THAILAND_ID','MALAYSIA_ID','VIETNAM_ID','INDONESIA_ID','HK_MACAO_RESIDENCE_PERMIT','TAIWAN_RESIDENCE_PERMIT','MEXICO_ID','SINGAPORE_ID','SINGAPORE_PR','SINGAPORE_EP','SINGAPORE_WP','SINGAPORE_SP','SINGAPORE_LOC','SINGAPORE_PLOC','SINGAPORE_STUDENT_PASS','PHILIPPINES_ID','HK_MACAO_NON_CHINESE_PERMIT','US_SSN','CANADA_SIN','MALAYSIA_OLD_ID','MALAYSIA_WP','MALAYSIA_PR','MALAYSIA_MILITARY_ID','MALAYSIA_POLICE_ID','MALAYSIA_PASSPORT','MALAYSIA_EP','MALAYSIA_PROFESSIONAL_VISIT_PASS','MALAYSIA_DEPENDENT_PASS','MALAYSIA_ENTREPRENEUR_PASS','MALAYSIA_TALENT_RESIDENCE_PASS','MALAYSIA_LONG_TERM_SOCIAL_VISIT_PASS','MALAYSIA_SHORT_TERM_SOCIAL_VISIT_PASS','MALAYSIA_FOREIGN_STUDENT_PASS','MALAYSIA_WORKING_HOLIDAY_PASS','MALAYSIA_PROFESSIONAL_TRAINING_PASS','MALAYSIA_TECHNICAL_TRAINING_PASS','IANG_VISA','HK_QUALITY_MIGRANT_ADMISSION_SCHEME','MAINLAND_TRAVEL_PERMIT_HK_MACAO','HK_TOP_TALENT_PASS_SCHEME','SINGAPORE_LONG_TERM_VISIT_PASS_SG14','HK_DOCUMENT_OF_IDENTITY','EXIT_ENTRY_PERMIT_HK_MACAO','SINGAPORE_ONE_PASS','SOUTH_KOREA_ID','OTHER') NOT NULL,
  `document_number` VARCHAR(191) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT false,
  `expiry_date` DATE NULL,
  `status` ENUM('ACTIVE','INACTIVE','ARCHIVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `archived_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `candidate_identity_documents_document_type_document_number_key`(`document_type`, `document_number`),
  INDEX `candidate_identity_documents_candidate_id_status_idx`(`candidate_id`, `status`),
  INDEX `candidate_identity_documents_expiry_date_status_idx`(`expiry_date`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `candidate_education_experiences` (
  `id` VARCHAR(191) NOT NULL,
  `candidate_id` VARCHAR(191) NOT NULL,
  `school_name` VARCHAR(191) NOT NULL,
  `education_level` ENUM('DOCTORAL','MASTER','MBA','BACHELOR','DUAL_BACHELOR','ASSOCIATE_DEGREE','OVERSEAS_HIGHER_EDUCATION','SECONDARY_TECHNICAL','HIGH_SCHOOL','JUNIOR_HIGH_OR_BELOW') NOT NULL,
  `major` VARCHAR(191) NULL,
  `graduation_date` DATE NULL,
  `is_highest_education` BOOLEAN NOT NULL DEFAULT false,
  `status` ENUM('ACTIVE','INACTIVE','ARCHIVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `archived_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `cand_edu_candidate_status_grad_idx`(`candidate_id`, `status`, `graduation_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `offer_compensation_snapshots` (
  `id` VARCHAR(191) NOT NULL,
  `offer_id` VARCHAR(191) NOT NULL,
  `salary_package` VARCHAR(191) NULL,
  `salary_remark` TEXT NULL,
  `pre_confirmation_base_salary` DECIMAL(12,2) NULL,
  `post_confirmation_base_salary` DECIMAL(12,2) NULL,
  `pre_confirmation_monthly_performance` DECIMAL(12,2) NULL,
  `post_confirmation_monthly_performance` DECIMAL(12,2) NULL,
  `pre_confirmation_monthly_management_performance` DECIMAL(12,2) NULL,
  `post_confirmation_monthly_management_performance` DECIMAL(12,2) NULL,
  `full_time_contract_salary` DECIMAL(12,2) NULL,
  `annual_performance` DECIMAL(12,2) NULL,
  `status` ENUM('ACTIVE','INACTIVE','ARCHIVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `archived_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `offer_compensation_snapshots_offer_id_key`(`offer_id`),
  INDEX `offer_compensation_snapshots_status_archived_at_idx`(`status`, `archived_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `offer_part_time_snapshots` (
  `id` VARCHAR(191) NOT NULL,
  `offer_id` VARCHAR(191) NOT NULL,
  `position_name` VARCHAR(191) NULL,
  `hourly_rate` DECIMAL(12,2) NULL,
  `status` ENUM('ACTIVE','INACTIVE','ARCHIVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `archived_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `offer_part_time_snapshots_offer_id_key`(`offer_id`),
  INDEX `offer_part_time_snapshots_status_archived_at_idx`(`status`, `archived_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;


-- CreateIndex
CREATE INDEX `offers_direct_manager_employee_id_idx` ON `offers`(`direct_manager_employee_id`);
CREATE INDEX `offers_employing_company_id_idx` ON `offers`(`employing_company_id`);

-- AddForeignKey
ALTER TABLE `candidate_identity_documents` ADD CONSTRAINT `candidate_identity_documents_candidate_id_fkey`
  FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `candidate_education_experiences` ADD CONSTRAINT `candidate_education_experiences_candidate_id_fkey`
  FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `offers` ADD CONSTRAINT `offers_direct_manager_employee_id_fkey`
  FOREIGN KEY (`direct_manager_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `offers` ADD CONSTRAINT `offers_employing_company_id_fkey`
  FOREIGN KEY (`employing_company_id`) REFERENCES `employing_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `offer_compensation_snapshots` ADD CONSTRAINT `offer_compensation_snapshots_offer_id_fkey`
  FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `offer_part_time_snapshots` ADD CONSTRAINT `offer_part_time_snapshots_offer_id_fkey`
  FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
