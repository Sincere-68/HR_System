-- AlterTable
ALTER TABLE `users` ADD COLUMN `archived_at` DATETIME(3) NULL,
    ADD COLUMN `employee_id` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `archive_reason` TEXT NULL,
    ADD COLUMN `archived_at` DATETIME(3) NULL,
    ADD COLUMN `archived_by_id` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `effective_date` DATE NULL,
    ADD COLUMN `expiry_date` DATE NULL,
    ADD COLUMN `organization_type` ENUM('COMPANY', 'CENTER', 'DEPARTMENT', 'GROUP', 'OTHER') NOT NULL DEFAULT 'DEPARTMENT',
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `archive_reason` TEXT NULL,
    ADD COLUMN `archived_at` DATETIME(3) NULL,
    ADD COLUMN `archived_by_id` VARCHAR(191) NULL,
    ADD COLUMN `birth_date` DATE NULL,
    ADD COLUMN `english_name` VARCHAR(191) NULL,
    ADD COLUMN `ethnicity` VARCHAR(191) NULL,
    ADD COLUMN `former_name` VARCHAR(191) NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED') NULL,
    ADD COLUMN `household_address` TEXT NULL,
    ADD COLUMN `marital_status` VARCHAR(191) NULL,
    ADD COLUMN `nationality` VARCHAR(191) NULL,
    ADD COLUMN `native_place` VARCHAR(191) NULL,
    ADD COLUMN `personal_email` VARCHAR(191) NULL,
    ADD COLUMN `personnel_type` ENUM('INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER') NOT NULL DEFAULT 'INTERNAL_EMPLOYEE',
    ADD COLUMN `political_status` VARCHAR(191) NULL,
    ADD COLUMN `profile_photo_id` VARCHAR(191) NULL,
    ADD COLUMN `record_status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `residential_address` TEXT NULL,
    ADD COLUMN `work_email` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `employment_records` ADD COLUMN `employment_period_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `positions` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `positions_code_key`(`code`),
    INDEX `positions_organization_id_status_idx`(`organization_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `job_levels` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rank_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_levels_code_key`(`code`),
    INDEX `job_levels_status_rank_order_idx`(`status`, `rank_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `job_titles` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_titles_code_key`(`code`),
    INDEX `job_titles_organization_id_status_idx`(`organization_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `workplaces` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workplaces_code_key`(`code`),
    INDEX `workplaces_status_archived_at_idx`(`status`, `archived_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employment_periods` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `sequence_no` INTEGER NOT NULL,
    `personnel_type` ENUM('INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER') NOT NULL,
    `entry_date` DATE NOT NULL,
    `planned_exit_date` DATE NULL,
    `actual_exit_date` DATE NULL,
    `employment_status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `is_rehire` BOOLEAN NOT NULL DEFAULT false,
    `previous_period_id` VARCHAR(191) NULL,
    `exit_reason` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employment_periods_employee_id_employment_status_actual_exit_idx`(`employee_id`, `employment_status`, `actual_exit_date`),
    INDEX `employment_periods_personnel_type_employment_status_idx`(`personnel_type`, `employment_status`),
    UNIQUE INDEX `employment_periods_employee_id_sequence_no_key`(`employee_id`, `sequence_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `employment_period_id` VARCHAR(191) NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `position_id` VARCHAR(191) NULL,
    `job_level_id` VARCHAR(191) NULL,
    `job_title_id` VARCHAR(191) NULL,
    `workplace_id` VARCHAR(191) NULL,
    `assignment_type` ENUM('PRIMARY', 'ADDITIONAL', 'TEMPORARY') NOT NULL DEFAULT 'PRIMARY',
    `work_arrangement` ENUM('FULL_TIME', 'PART_TIME') NOT NULL DEFAULT 'FULL_TIME',
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `change_reason` TEXT NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_assignments_employee_id_status_end_date_idx`(`employee_id`, `status`, `end_date`),
    INDEX `employee_assignments_organization_id_status_end_date_idx`(`organization_id`, `status`, `end_date`),
    INDEX `employee_assignments_employment_period_id_idx`(`employment_period_id`),
    INDEX `employee_assignments_is_primary_status_idx`(`is_primary`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `reporting_relationships` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `manager_employee_id` VARCHAR(191) NOT NULL,
    `relationship_type` ENUM('ADMINISTRATIVE', 'BUSINESS', 'PROJECT', 'FUNCTIONAL', 'OTHER') NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reporting_relationships_employee_id_status_end_date_idx`(`employee_id`, `status`, `end_date`),
    INDEX `reporting_relationships_manager_employee_id_status_end_date_idx`(`manager_employee_id`, `status`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_identity_documents` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `document_type` ENUM('NATIONAL_ID', 'PASSPORT', 'HK_MACAO_PERMIT', 'TAIWAN_PERMIT', 'RESIDENCE_PERMIT', 'OTHER') NOT NULL,
    `document_number` VARCHAR(191) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `issuing_country` VARCHAR(191) NULL,
    `issuing_authority` VARCHAR(191) NULL,
    `issue_date` DATE NULL,
    `expiry_date` DATE NULL,
    `front_attachment_id` VARCHAR(191) NULL,
    `back_attachment_id` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_identity_documents_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `employee_identity_documents_expiry_date_status_idx`(`expiry_date`, `status`),
    UNIQUE INDEX `employee_identity_documents_document_type_document_number_key`(`document_type`, `document_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `file_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `checksum` VARCHAR(191) NULL,
    `uploaded_by_id` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `file_attachments_storage_key_key`(`storage_key`),
    INDEX `file_attachments_uploaded_by_id_status_idx`(`uploaded_by_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_family_members` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED') NULL,
    `birth_date` DATE NULL,
    `identity_document_no` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `work_organization` VARCHAR(191) NULL,
    `position_name` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `is_emergency_contact` BOOLEAN NOT NULL DEFAULT false,
    `is_dependent` BOOLEAN NOT NULL DEFAULT false,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_family_members_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_education_experiences` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `school_name` VARCHAR(191) NOT NULL,
    `education_level` VARCHAR(191) NOT NULL,
    `degree` VARCHAR(191) NULL,
    `major` VARCHAR(191) NULL,
    `study_type` VARCHAR(191) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `graduation_date` DATE NULL,
    `certificate_no` VARCHAR(191) NULL,
    `is_highest_education` BOOLEAN NOT NULL DEFAULT false,
    `is_first_education` BOOLEAN NOT NULL DEFAULT false,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_education_experiences_employee_id_status_end_date_idx`(`employee_id`, `status`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_work_experiences` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NOT NULL,
    `department_name` VARCHAR(191) NULL,
    `position_name` VARCHAR(191) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `job_description` TEXT NULL,
    `leaving_reason` TEXT NULL,
    `reference_name` VARCHAR(191) NULL,
    `reference_mobile` VARCHAR(191) NULL,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_work_experiences_employee_id_status_start_date_idx`(`employee_id`, `status`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_appraisals` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `appraisal_period` VARCHAR(191) NOT NULL,
    `appraisal_type` VARCHAR(191) NOT NULL,
    `score` DECIMAL(8, 2) NULL,
    `grade` VARCHAR(191) NULL,
    `result` VARCHAR(191) NULL,
    `evaluator_user_id` VARCHAR(191) NULL,
    `appraisal_date` DATE NULL,
    `comment` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_appraisals_employee_id_status_appraisal_date_idx`(`employee_id`, `status`, `appraisal_date`),
    INDEX `employee_appraisals_evaluator_user_id_status_idx`(`evaluator_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_training_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `training_name` VARCHAR(191) NOT NULL,
    `training_provider` VARCHAR(191) NULL,
    `training_type` VARCHAR(191) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `hours` DECIMAL(8, 2) NULL,
    `result` VARCHAR(191) NULL,
    `cost` DECIMAL(12, 2) NULL,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_training_records_employee_id_status_start_date_idx`(`employee_id`, `status`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_awards` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `award_name` VARCHAR(191) NOT NULL,
    `award_level` VARCHAR(191) NULL,
    `awarding_organization` VARCHAR(191) NULL,
    `award_date` DATE NULL,
    `reason` TEXT NULL,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_awards_employee_id_status_award_date_idx`(`employee_id`, `status`, `award_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_certificates` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `certificate_type` VARCHAR(191) NOT NULL,
    `certificate_name` VARCHAR(191) NOT NULL,
    `certificate_no` VARCHAR(191) NULL,
    `issuing_authority` VARCHAR(191) NULL,
    `issue_date` DATE NULL,
    `expiry_date` DATE NULL,
    `attachment_id` VARCHAR(191) NULL,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_certificates_employee_id_status_expiry_date_idx`(`employee_id`, `status`, `expiry_date`),
    INDEX `employee_certificates_certificate_no_idx`(`certificate_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_project_experiences` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `project_name` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NULL,
    `project_role` VARCHAR(191) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `project_description` TEXT NULL,
    `responsibilities` TEXT NULL,
    `project_result` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_project_experiences_employee_id_status_start_date_idx`(`employee_id`, `status`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_skills` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `skill_name` VARCHAR(191) NOT NULL,
    `skill_category` VARCHAR(191) NULL,
    `proficiency_level` VARCHAR(191) NULL,
    `years_of_experience` DECIMAL(5, 2) NULL,
    `is_certified` BOOLEAN NOT NULL DEFAULT false,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_skills_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_language_abilities` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `listening_level` VARCHAR(191) NULL,
    `speaking_level` VARCHAR(191) NULL,
    `reading_level` VARCHAR(191) NULL,
    `writing_level` VARCHAR(191) NULL,
    `certificate_name` VARCHAR(191) NULL,
    `certificate_score` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_language_abilities_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_documents` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `document_name` VARCHAR(191) NOT NULL,
    `attachment_id` VARCHAR(191) NOT NULL,
    `expiry_date` DATE NULL,
    `remark` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_documents_employee_id_document_type_status_idx`(`employee_id`, `document_type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_blacklist_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `document_type` ENUM('NATIONAL_ID', 'PASSPORT', 'HK_MACAO_PERMIT', 'TAIWAN_PERMIT', 'RESIDENCE_PERMIT', 'OTHER') NULL,
    `document_number` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `reason` TEXT NOT NULL,
    `effective_date` DATE NOT NULL,
    `expiry_date` DATE NULL,
    `created_by_id` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_blacklist_records_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `employee_blacklist_records_document_number_status_idx`(`document_number`, `status`),
    INDEX `employee_blacklist_records_created_by_id_status_idx`(`created_by_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `candidates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `resume_attachment_id` VARCHAR(191) NULL,
    `converted_employee_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `candidates_mobile_idx`(`mobile`),
    INDEX `candidates_status_archived_at_idx`(`status`, `archived_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `offers` (
    `id` VARCHAR(191) NOT NULL,
    `offer_no` VARCHAR(191) NOT NULL,
    `candidate_id` VARCHAR(191) NOT NULL,
    `accepted_employee_id` VARCHAR(191) NULL,
    `organization_id` VARCHAR(191) NULL,
    `position_id` VARCHAR(191) NULL,
    `workplace_id` VARCHAR(191) NULL,
    `personnel_type` ENUM('INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER') NOT NULL,
    `proposed_entry_date` DATE NULL,
    `probation_months` INTEGER NULL,
    `offered_monthly_salary` DECIMAL(12, 2) NULL,
    `issue_date` DATE NULL,
    `expiry_date` DATE NULL,
    `accepted_at` DATETIME(3) NULL,
    `rejected_reason` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offers_offer_no_key`(`offer_no`),
    INDEX `offers_candidate_id_status_idx`(`candidate_id`, `status`),
    INDEX `offers_organization_id_proposed_entry_date_idx`(`organization_id`, `proposed_entry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `onboarding_cases` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `offer_id` VARCHAR(191) NULL,
    `planned_entry_date` DATE NOT NULL,
    `actual_entry_date` DATE NULL,
    `owner_user_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `completed_at` DATETIME(3) NULL,
    `remark` TEXT NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `onboarding_cases_offer_id_key`(`offer_id`),
    INDEX `onboarding_cases_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `onboarding_cases_planned_entry_date_status_idx`(`planned_entry_date`, `status`),
    INDEX `onboarding_cases_owner_user_id_status_idx`(`owner_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `onboarding_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `onboarding_case_id` VARCHAR(191) NOT NULL,
    `task_type` VARCHAR(191) NOT NULL,
    `task_name` VARCHAR(191) NOT NULL,
    `responsible_user_id` VARCHAR(191) NULL,
    `due_date` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `onboarding_tasks_onboarding_case_id_status_idx`(`onboarding_case_id`, `status`),
    INDEX `onboarding_tasks_responsible_user_id_due_date_status_idx`(`responsible_user_id`, `due_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `onboarding_integration_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `plan_name` VARCHAR(191) NOT NULL,
    `mentor_employee_id` VARCHAR(191) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `feedback` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `onboarding_integration_records_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_introductions` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `published_at` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_introductions_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `probation_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `employment_period_id` VARCHAR(191) NULL,
    `start_date` DATE NOT NULL,
    `planned_end_date` DATE NOT NULL,
    `actual_end_date` DATE NULL,
    `result` VARCHAR(191) NULL,
    `evaluation` TEXT NULL,
    `confirmed_date` DATE NULL,
    `extension_count` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `probation_records_employee_id_status_planned_end_date_idx`(`employee_id`, `status`, `planned_end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `movement_types` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `movement_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_movements` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `movement_type_id` VARCHAR(191) NOT NULL,
    `from_organization_id` VARCHAR(191) NULL,
    `to_organization_id` VARCHAR(191) NULL,
    `from_position_id` VARCHAR(191) NULL,
    `to_position_id` VARCHAR(191) NULL,
    `from_job_level_id` VARCHAR(191) NULL,
    `to_job_level_id` VARCHAR(191) NULL,
    `effective_date` DATE NOT NULL,
    `reason` TEXT NULL,
    `approval_request_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_movements_approval_request_id_key`(`approval_request_id`),
    INDEX `employee_movements_employee_id_status_effective_date_idx`(`employee_id`, `status`, `effective_date`),
    INDEX `employee_movements_movement_type_id_effective_date_idx`(`movement_type_id`, `effective_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `trial_post_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `target_position_id` VARCHAR(191) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `result` VARCHAR(191) NULL,
    `evaluator_user_id` VARCHAR(191) NULL,
    `comment` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trial_post_records_employee_id_status_start_date_idx`(`employee_id`, `status`, `start_date`),
    INDEX `trial_post_records_evaluator_user_id_status_idx`(`evaluator_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `termination_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `employment_period_id` VARCHAR(191) NULL,
    `application_date` DATE NULL,
    `planned_last_working_date` DATE NOT NULL,
    `actual_last_working_date` DATE NULL,
    `termination_type` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `rehire_eligible` BOOLEAN NULL,
    `handover_case_id` VARCHAR(191) NULL,
    `approval_request_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `termination_records_handover_case_id_key`(`handover_case_id`),
    UNIQUE INDEX `termination_records_approval_request_id_key`(`approval_request_id`),
    INDEX `termination_records_employee_id_status_planned_last_working__idx`(`employee_id`, `status`, `planned_last_working_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `retirement_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `employment_period_id` VARCHAR(191) NULL,
    `planned_retirement_date` DATE NOT NULL,
    `actual_retirement_date` DATE NULL,
    `retirement_type` VARCHAR(191) NOT NULL,
    `pension_handling_status` VARCHAR(191) NULL,
    `remark` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `retirement_records_employee_id_status_planned_retirement_dat_idx`(`employee_id`, `status`, `planned_retirement_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_agreements` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `employment_period_id` VARCHAR(191) NULL,
    `agreement_no` VARCHAR(191) NOT NULL,
    `agreement_type` ENUM('LABOR_CONTRACT', 'INTERNSHIP_AGREEMENT', 'SERVICE_AGREEMENT', 'CONFIDENTIALITY_AGREEMENT', 'NON_COMPETE_AGREEMENT', 'TRAINING_SERVICE_AGREEMENT', 'OTHER') NOT NULL,
    `signing_organization_id` VARCHAR(191) NULL,
    `previous_agreement_id` VARCHAR(191) NULL,
    `signing_date` DATE NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `probation_end_date` DATE NULL,
    `work_location` VARCHAR(191) NULL,
    `renewal_sequence` INTEGER NOT NULL DEFAULT 0,
    `termination_date` DATE NULL,
    `termination_reason` TEXT NULL,
    `attachment_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_agreements_agreement_no_key`(`agreement_no`),
    INDEX `employee_agreements_employee_id_status_end_date_idx`(`employee_id`, `status`, `end_date`),
    INDEX `employee_agreements_signing_organization_id_status_idx`(`signing_organization_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `approval_requests` (
    `id` VARCHAR(191) NOT NULL,
    `business_type` VARCHAR(191) NOT NULL,
    `business_id` VARCHAR(191) NULL,
    `applicant_user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `current_step` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `submitted_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_requests_business_type_business_id_idx`(`business_type`, `business_id`),
    INDEX `approval_requests_applicant_user_id_status_idx`(`applicant_user_id`, `status`),
    INDEX `approval_requests_status_submitted_at_idx`(`status`, `submitted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `approval_steps` (
    `id` VARCHAR(191) NOT NULL,
    `approval_request_id` VARCHAR(191) NOT NULL,
    `step_order` INTEGER NOT NULL,
    `approver_user_id` VARCHAR(191) NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `comment` TEXT NULL,
    `operated_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_steps_approver_user_id_decision_idx`(`approver_user_id`, `decision`),
    UNIQUE INDEX `approval_steps_approval_request_id_step_order_key`(`approval_request_id`, `step_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `employee_change_requests` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `approval_request_id` VARCHAR(191) NULL,
    `changed_fields` JSON NOT NULL,
    `old_values` JSON NULL,
    `new_values` JSON NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_change_requests_approval_request_id_key`(`approval_request_id`),
    INDEX `employee_change_requests_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `staffing_plans` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `position_id` VARCHAR(191) NULL,
    `plan_year` INTEGER NOT NULL,
    `approved_headcount` INTEGER NOT NULL,
    `frozen_headcount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `staffing_plans_plan_year_status_idx`(`plan_year`, `status`),
    UNIQUE INDEX `staffing_plans_organization_id_position_id_plan_year_key`(`organization_id`, `position_id`, `plan_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `handover_cases` (
    `id` VARCHAR(191) NOT NULL,
    `source_employee_id` VARCHAR(191) NOT NULL,
    `target_employee_id` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `planned_date` DATE NULL,
    `completed_date` DATE NULL,
    `owner_user_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `handover_cases_source_employee_id_status_idx`(`source_employee_id`, `status`),
    INDEX `handover_cases_target_employee_id_status_idx`(`target_employee_id`, `status`),
    INDEX `handover_cases_owner_user_id_status_idx`(`owner_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `handover_items` (
    `id` VARCHAR(191) NOT NULL,
    `handover_case_id` VARCHAR(191) NOT NULL,
    `item_type` VARCHAR(191) NOT NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `attachment_id` VARCHAR(191) NULL,
    `confirmation_status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `confirmed_at` DATETIME(3) NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `handover_items_handover_case_id_confirmation_status_idx`(`handover_case_id`, `confirmation_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `dictionary_types` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dictionary_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `dictionary_items` (
    `id` VARCHAR(191) NOT NULL,
    `dictionary_type_id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `extra_data` JSON NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dictionary_items_dictionary_type_id_status_sort_order_idx`(`dictionary_type_id`, `status`, `sort_order`),
    UNIQUE INDEX `dictionary_items_dictionary_type_id_code_key`(`dictionary_type_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `report_definitions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `data_source` VARCHAR(191) NOT NULL,
    `selected_fields` JSON NOT NULL,
    `filters` JSON NULL,
    `grouping` JSON NULL,
    `sorting` JSON NULL,
    `creator_user_id` VARCHAR(191) NOT NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE',
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `report_definitions_creator_user_id_status_idx`(`creator_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_employee_id_key` ON `users`(`employee_id`);

-- CreateIndex
CREATE INDEX `users_status_archived_at_idx` ON `users`(`status`, `archived_at`);

-- CreateIndex
CREATE INDEX `organizations_archived_by_id_idx` ON `organizations`(`archived_by_id`);

-- CreateIndex
CREATE INDEX `organizations_organization_type_status_idx` ON `organizations`(`organization_type`, `status`);

-- CreateIndex
CREATE INDEX `organizations_status_archived_at_idx` ON `organizations`(`status`, `archived_at`);

-- CreateIndex
CREATE UNIQUE INDEX `employees_profile_photo_id_key` ON `employees`(`profile_photo_id`);

-- CreateIndex
CREATE INDEX `employees_archived_by_id_idx` ON `employees`(`archived_by_id`);

-- CreateIndex
CREATE INDEX `employees_personnel_type_record_status_idx` ON `employees`(`personnel_type`, `record_status`);

-- CreateIndex
CREATE INDEX `employees_record_status_archived_at_idx` ON `employees`(`record_status`, `archived_at`);

-- CreateIndex
CREATE INDEX `employment_records_employment_period_id_idx` ON `employment_records`(`employment_period_id`);

-- Backfill compatibility data for existing employees. IDs are deterministic so
-- the migration is auditable and the old columns can remain in service while
-- APIs move to the normalized relations.
INSERT INTO `employment_periods` (
    `id`, `employee_id`, `sequence_no`, `personnel_type`, `entry_date`,
    `employment_status`, `is_rehire`, `status`, `created_at`, `updated_at`
)
SELECT
    CONCAT('migr-period-', SHA2(e.`id`, 256)),
    e.`id`,
    1,
    'INTERNAL_EMPLOYEE',
    DATE(COALESCE(MIN(er.`effective_at`), e.`created_at`)),
    CASE
        WHEN MAX(CASE WHEN er.`current_flag` = true AND er.`status` = 'ACTIVE' THEN 1 ELSE 0 END) = 1
            THEN 'ACTIVE'
        ELSE 'INACTIVE'
    END,
    false,
    'ACTIVE',
    e.`created_at`,
    e.`updated_at`
FROM `employees` e
LEFT JOIN `employment_records` er ON er.`employee_id` = e.`id`
GROUP BY e.`id`, e.`created_at`, e.`updated_at`;

INSERT INTO `employee_assignments` (
    `id`, `employee_id`, `employment_period_id`, `organization_id`,
    `assignment_type`, `work_arrangement`, `is_primary`, `start_date`,
    `status`, `created_at`, `updated_at`
)
SELECT
    CONCAT('migr-assignment-', SHA2(e.`id`, 256)),
    e.`id`,
    CONCAT('migr-period-', SHA2(e.`id`, 256)),
    e.`organization_id`,
    'PRIMARY',
    'FULL_TIME',
    true,
    DATE(COALESCE(MIN(er.`effective_at`), e.`created_at`)),
    'ACTIVE',
    e.`created_at`,
    e.`updated_at`
FROM `employees` e
LEFT JOIN `employment_records` er ON er.`employee_id` = e.`id`
GROUP BY e.`id`, e.`organization_id`, e.`created_at`, e.`updated_at`;

INSERT INTO `employee_identity_documents` (
    `id`, `employee_id`, `document_type`, `document_number`, `is_primary`,
    `status`, `created_at`, `updated_at`
)
SELECT
    CONCAT('migr-document-', SHA2(e.`id`, 256)),
    e.`id`,
    'NATIONAL_ID',
    e.`id_card_no`,
    true,
    'ACTIVE',
    e.`created_at`,
    e.`updated_at`
FROM `employees` e;

UPDATE `employment_records`
SET `employment_period_id` = CONCAT('migr-period-', SHA2(`employee_id`, 256))
WHERE `employment_period_id` IS NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_archived_by_id_fkey` FOREIGN KEY (`archived_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_archived_by_id_fkey` FOREIGN KEY (`archived_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_profile_photo_id_fkey` FOREIGN KEY (`profile_photo_id`) REFERENCES `file_attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `positions` ADD CONSTRAINT `positions_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_titles` ADD CONSTRAINT `job_titles_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employment_periods` ADD CONSTRAINT `employment_periods_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employment_periods` ADD CONSTRAINT `employment_periods_previous_period_id_fkey` FOREIGN KEY (`previous_period_id`) REFERENCES `employment_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_assignments` ADD CONSTRAINT `employee_assignments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_assignments` ADD CONSTRAINT `employee_assignments_employment_period_id_fkey` FOREIGN KEY (`employment_period_id`) REFERENCES `employment_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_assignments` ADD CONSTRAINT `employee_assignments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_assignments` ADD CONSTRAINT `employee_assignments_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_assignments` ADD CONSTRAINT `employee_assignments_job_level_id_fkey` FOREIGN KEY (`job_level_id`) REFERENCES `job_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_assignments` ADD CONSTRAINT `employee_assignments_job_title_id_fkey` FOREIGN KEY (`job_title_id`) REFERENCES `job_titles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_assignments` ADD CONSTRAINT `employee_assignments_workplace_id_fkey` FOREIGN KEY (`workplace_id`) REFERENCES `workplaces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reporting_relationships` ADD CONSTRAINT `reporting_relationships_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reporting_relationships` ADD CONSTRAINT `reporting_relationships_manager_employee_id_fkey` FOREIGN KEY (`manager_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_identity_documents` ADD CONSTRAINT `employee_identity_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_identity_documents` ADD CONSTRAINT `employee_identity_documents_front_attachment_id_fkey` FOREIGN KEY (`front_attachment_id`) REFERENCES `file_attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_identity_documents` ADD CONSTRAINT `employee_identity_documents_back_attachment_id_fkey` FOREIGN KEY (`back_attachment_id`) REFERENCES `file_attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employment_records` ADD CONSTRAINT `employment_records_employment_period_id_fkey` FOREIGN KEY (`employment_period_id`) REFERENCES `employment_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_attachments` ADD CONSTRAINT `file_attachments_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_family_members` ADD CONSTRAINT `employee_family_members_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_education_experiences` ADD CONSTRAINT `employee_education_experiences_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_work_experiences` ADD CONSTRAINT `employee_work_experiences_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_appraisals` ADD CONSTRAINT `employee_appraisals_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_appraisals` ADD CONSTRAINT `employee_appraisals_evaluator_user_id_fkey` FOREIGN KEY (`evaluator_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_training_records` ADD CONSTRAINT `employee_training_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_awards` ADD CONSTRAINT `employee_awards_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_certificates` ADD CONSTRAINT `employee_certificates_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_certificates` ADD CONSTRAINT `employee_certificates_attachment_id_fkey` FOREIGN KEY (`attachment_id`) REFERENCES `file_attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_project_experiences` ADD CONSTRAINT `employee_project_experiences_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_skills` ADD CONSTRAINT `employee_skills_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_language_abilities` ADD CONSTRAINT `employee_language_abilities_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_attachment_id_fkey` FOREIGN KEY (`attachment_id`) REFERENCES `file_attachments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_blacklist_records` ADD CONSTRAINT `employee_blacklist_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_blacklist_records` ADD CONSTRAINT `employee_blacklist_records_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidates` ADD CONSTRAINT `candidates_converted_employee_id_fkey` FOREIGN KEY (`converted_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_accepted_employee_id_fkey` FOREIGN KEY (`accepted_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_workplace_id_fkey` FOREIGN KEY (`workplace_id`) REFERENCES `workplaces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_cases` ADD CONSTRAINT `onboarding_cases_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_cases` ADD CONSTRAINT `onboarding_cases_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_cases` ADD CONSTRAINT `onboarding_cases_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_tasks` ADD CONSTRAINT `onboarding_tasks_onboarding_case_id_fkey` FOREIGN KEY (`onboarding_case_id`) REFERENCES `onboarding_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_tasks` ADD CONSTRAINT `onboarding_tasks_responsible_user_id_fkey` FOREIGN KEY (`responsible_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_integration_records` ADD CONSTRAINT `onboarding_integration_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_introductions` ADD CONSTRAINT `employee_introductions_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `probation_records` ADD CONSTRAINT `probation_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `probation_records` ADD CONSTRAINT `probation_records_employment_period_id_fkey` FOREIGN KEY (`employment_period_id`) REFERENCES `employment_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_movement_type_id_fkey` FOREIGN KEY (`movement_type_id`) REFERENCES `movement_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_from_organization_id_fkey` FOREIGN KEY (`from_organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_to_organization_id_fkey` FOREIGN KEY (`to_organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_from_position_id_fkey` FOREIGN KEY (`from_position_id`) REFERENCES `positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_to_position_id_fkey` FOREIGN KEY (`to_position_id`) REFERENCES `positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_from_job_level_id_fkey` FOREIGN KEY (`from_job_level_id`) REFERENCES `job_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_to_job_level_id_fkey` FOREIGN KEY (`to_job_level_id`) REFERENCES `job_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_movements` ADD CONSTRAINT `employee_movements_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trial_post_records` ADD CONSTRAINT `trial_post_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trial_post_records` ADD CONSTRAINT `trial_post_records_target_position_id_fkey` FOREIGN KEY (`target_position_id`) REFERENCES `positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trial_post_records` ADD CONSTRAINT `trial_post_records_evaluator_user_id_fkey` FOREIGN KEY (`evaluator_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `termination_records` ADD CONSTRAINT `termination_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `termination_records` ADD CONSTRAINT `termination_records_employment_period_id_fkey` FOREIGN KEY (`employment_period_id`) REFERENCES `employment_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `termination_records` ADD CONSTRAINT `termination_records_handover_case_id_fkey` FOREIGN KEY (`handover_case_id`) REFERENCES `handover_cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `termination_records` ADD CONSTRAINT `termination_records_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `retirement_records` ADD CONSTRAINT `retirement_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `retirement_records` ADD CONSTRAINT `retirement_records_employment_period_id_fkey` FOREIGN KEY (`employment_period_id`) REFERENCES `employment_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_agreements` ADD CONSTRAINT `employee_agreements_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_agreements` ADD CONSTRAINT `employee_agreements_employment_period_id_fkey` FOREIGN KEY (`employment_period_id`) REFERENCES `employment_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_agreements` ADD CONSTRAINT `employee_agreements_signing_organization_id_fkey` FOREIGN KEY (`signing_organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_agreements` ADD CONSTRAINT `employee_agreements_previous_agreement_id_fkey` FOREIGN KEY (`previous_agreement_id`) REFERENCES `employee_agreements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_agreements` ADD CONSTRAINT `employee_agreements_attachment_id_fkey` FOREIGN KEY (`attachment_id`) REFERENCES `file_attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_applicant_user_id_fkey` FOREIGN KEY (`applicant_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_steps` ADD CONSTRAINT `approval_steps_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_steps` ADD CONSTRAINT `approval_steps_approver_user_id_fkey` FOREIGN KEY (`approver_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_change_requests` ADD CONSTRAINT `employee_change_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_change_requests` ADD CONSTRAINT `employee_change_requests_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staffing_plans` ADD CONSTRAINT `staffing_plans_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staffing_plans` ADD CONSTRAINT `staffing_plans_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_cases` ADD CONSTRAINT `handover_cases_source_employee_id_fkey` FOREIGN KEY (`source_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_cases` ADD CONSTRAINT `handover_cases_target_employee_id_fkey` FOREIGN KEY (`target_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_cases` ADD CONSTRAINT `handover_cases_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_items` ADD CONSTRAINT `handover_items_handover_case_id_fkey` FOREIGN KEY (`handover_case_id`) REFERENCES `handover_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_items` ADD CONSTRAINT `handover_items_attachment_id_fkey` FOREIGN KEY (`attachment_id`) REFERENCES `file_attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dictionary_items` ADD CONSTRAINT `dictionary_items_dictionary_type_id_fkey` FOREIGN KEY (`dictionary_type_id`) REFERENCES `dictionary_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_definitions` ADD CONSTRAINT `report_definitions_creator_user_id_fkey` FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

