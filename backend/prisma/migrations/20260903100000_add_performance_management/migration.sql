-- Add template-driven performance management records.
-- Additive migration only. Review and back up the target MySQL database before applying.

CREATE TABLE `performance_templates` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('ACTIVE','INACTIVE','ARCHIVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `archived_at` DATETIME(3) NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `performance_templates_created_by_id_status_idx` (`created_by_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `performance_template_versions` (
  `id` VARCHAR(191) NOT NULL,
  `template_id` VARCHAR(191) NOT NULL,
  `version_no` INTEGER NOT NULL,
  `source_name` VARCHAR(191) NULL,
  `source_markdown` LONGTEXT NOT NULL,
  `definition` JSON NOT NULL,
  `status` ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `published_at` DATETIME(3) NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `performance_template_versions_template_id_version_no_key` (`template_id`, `version_no`),
  INDEX `performance_template_versions_template_id_status_idx` (`template_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `performance_cycles` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `template_id` VARCHAR(191) NOT NULL,
  `template_version_id` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','PENDING','APPROVED','REJECTED','WITHDRAWN','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `created_by_id` VARCHAR(191) NOT NULL,
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `performance_cycles_template_version_id_status_idx` (`template_version_id`, `status`),
  INDEX `performance_cycles_period_start_period_end_status_idx` (`period_start`, `period_end`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `performance_amount_base_versions` (
  `id` VARCHAR(191) NOT NULL,
  `version_no` INTEGER NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `previous_amount` DECIMAL(12,2) NULL,
  `effective_at` DATETIME(3) NOT NULL,
  `changed_by_id` VARCHAR(191) NOT NULL,
  `change_reason` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `performance_amount_base_versions_version_no_key` (`version_no`),
  INDEX `performance_amount_base_versions_effective_at_idx` (`effective_at`),
  INDEX `performance_amount_base_versions_changed_by_id_created_at_idx` (`changed_by_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `performance_instances` (
  `id` VARCHAR(191) NOT NULL,
  `cycle_id` VARCHAR(191) NOT NULL,
  `employee_id` VARCHAR(191) NOT NULL,
  `source_markdown` LONGTEXT NOT NULL,
  `definition_snapshot` JSON NOT NULL,
  `organization_id` VARCHAR(191) NULL,
  `current_module_order` INTEGER NULL,
  `fixed_weighted_score` DECIMAL(10,4) NULL,
  `adjustment_score` DECIMAL(10,4) NOT NULL DEFAULT 0,
  `raw_final_score` DECIMAL(10,4) NULL,
  `final_score` DECIMAL(10,4) NULL,
  `amount_base_version_id` VARCHAR(191) NULL,
  `amount_base_snapshot` DECIMAL(12,2) NULL,
  `calculation_formula` TEXT NULL,
  `actual_amount` DECIMAL(12,2) NULL,
  `status` ENUM('DRAFT','PENDING','APPROVED','REJECTED','WITHDRAWN','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `performance_instances_cycle_id_employee_id_key` (`cycle_id`, `employee_id`),
  INDEX `performance_instances_employee_id_status_idx` (`employee_id`, `status`),
  INDEX `performance_instances_organization_id_status_idx` (`organization_id`, `status`),
  INDEX `performance_instances_cycle_id_status_idx` (`cycle_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `performance_module_tasks` (
  `id` VARCHAR(191) NOT NULL,
  `instance_id` VARCHAR(191) NOT NULL,
  `employee_id` VARCHAR(191) NOT NULL,
  `module_id` VARCHAR(191) NOT NULL,
  `module_order` INTEGER NOT NULL,
  `module_name` VARCHAR(191) NOT NULL,
  `module_type` ENUM('METRIC','EVALUATION','ADJUSTMENT') NOT NULL,
  `module_weight` DECIMAL(10,4) NULL,
  `module_snapshot` JSON NOT NULL,
  `executor_type` ENUM('AUTO','USER','DIRECTORY') NOT NULL,
  `executor_user_id` VARCHAR(191) NULL,
  `executor_directory_type` ENUM('POSITION','JOB_TITLE') NULL,
  `executor_directory_id` VARCHAR(191) NULL,
  `executor_name_snapshot` VARCHAR(191) NULL,
  `executor_account_snapshot` VARCHAR(191) NULL,
  `executor_resolved_at` DATETIME(3) NULL,
  `status` ENUM('PENDING','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `raw_data` JSON NULL,
  `calculation_details` JSON NULL,
  `submission` JSON NULL,
  `module_score` DECIMAL(10,4) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `performance_module_tasks_instance_id_module_order_key` (`instance_id`, `module_order`),
  INDEX `performance_module_tasks_executor_user_id_status_idx` (`executor_user_id`, `status`),
  INDEX `performance_module_tasks_employee_id_status_idx` (`employee_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `performance_result_revisions` (
  `id` VARCHAR(191) NOT NULL,
  `instance_id` VARCHAR(191) NOT NULL,
  `revision_no` INTEGER NOT NULL,
  `previous_score` DECIMAL(10,4) NOT NULL,
  `next_score` DECIMAL(10,4) NOT NULL,
  `score_delta` DECIMAL(10,4) NOT NULL,
  `previous_amount` DECIMAL(12,2) NULL,
  `next_amount` DECIMAL(12,2) NULL,
  `reason` TEXT NOT NULL,
  `before_snapshot` JSON NOT NULL,
  `after_snapshot` JSON NOT NULL,
  `modified_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `performance_result_revisions_instance_id_revision_no_key` (`instance_id`, `revision_no`),
  INDEX `performance_result_revisions_modified_by_id_created_at_idx` (`modified_by_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `performance_templates`
  ADD CONSTRAINT `performance_templates_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `performance_template_versions`
  ADD CONSTRAINT `performance_template_versions_template_id_fkey`
  FOREIGN KEY (`template_id`) REFERENCES `performance_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_template_versions_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `performance_cycles`
  ADD CONSTRAINT `performance_cycles_template_id_fkey`
  FOREIGN KEY (`template_id`) REFERENCES `performance_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_cycles_template_version_id_fkey`
  FOREIGN KEY (`template_version_id`) REFERENCES `performance_template_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_cycles_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `performance_amount_base_versions`
  ADD CONSTRAINT `performance_amount_base_versions_changed_by_id_fkey`
  FOREIGN KEY (`changed_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `performance_instances`
  ADD CONSTRAINT `performance_instances_cycle_id_fkey`
  FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_instances_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_instances_organization_id_fkey`
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_instances_amount_base_version_id_fkey`
  FOREIGN KEY (`amount_base_version_id`) REFERENCES `performance_amount_base_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `performance_module_tasks`
  ADD CONSTRAINT `performance_module_tasks_instance_id_fkey`
  FOREIGN KEY (`instance_id`) REFERENCES `performance_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_module_tasks_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_module_tasks_executor_user_id_fkey`
  FOREIGN KEY (`executor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `performance_result_revisions`
  ADD CONSTRAINT `performance_result_revisions_instance_id_fkey`
  FOREIGN KEY (`instance_id`) REFERENCES `performance_instances`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_result_revisions_modified_by_id_fkey`
  FOREIGN KEY (`modified_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
