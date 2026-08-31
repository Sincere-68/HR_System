-- The user confirmed all historical FULL_TIME values are test data. Replace
-- them with the approved default before narrowing the database enum, so the
-- Prisma/shared/API contract has no unapproved compatibility value.
ALTER TABLE `employee_assignments`
    MODIFY COLUMN `work_arrangement`
    ENUM(
      'FULL_TIME',
      'PART_TIME',
      'LABOR_DISPATCH',
      'CONTRACT_EMPLOYMENT',
      'LABOR_EMPLOYMENT',
      'INTERN',
      'RETIREE_REEMPLOYMENT'
    ) NOT NULL;

UPDATE `employee_assignments`
SET `work_arrangement` = 'CONTRACT_EMPLOYMENT'
WHERE `work_arrangement` = 'FULL_TIME';

ALTER TABLE `employee_assignments`
    MODIFY COLUMN `work_arrangement`
    ENUM(
      'PART_TIME',
      'LABOR_DISPATCH',
      'CONTRACT_EMPLOYMENT',
      'LABOR_EMPLOYMENT',
      'INTERN',
      'RETIREE_REEMPLOYMENT'
    ) NOT NULL;

CREATE TABLE `personnel_positions` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `personnel_positions_code_key`(`code`),
    INDEX `personnel_positions_status_sort_order_idx`(`status`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `employee_levels` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rank_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `employee_levels_code_key`(`code`),
    INDEX `employee_levels_status_rank_order_idx`(`status`, `rank_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `employing_companies` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `employing_companies_code_key`(`code`),
    INDEX `employing_companies_status_sort_order_idx`(`status`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `employees`
    MODIFY COLUMN `ethnicity`
    ENUM(
      'HAN','HUI','SHE','TATAR','ACHANG','KAZAKH','TUJIA','JINGPO','HANI','TU',
      'BAI','UYGHUR','BONAN','HEZHEN','UZBEK','JINO','BUYI','LAHU','XIBE','LI',
      'DONGXIANG','MONGOL','MULAO','DAUR','TIBETAN','MAONAN','YUGUR','RUSSIAN','DEANG','LISU',
      'YAO','KOREAN','BLANG','MANCHU','YI','MONBA','DONG','MIAO','WA','QIANG',
      'DERUNG','NU','LHOBA','PUMI','DAI','NAXI','GAOSHAN','ZHUANG','OROQEN','TAJIK',
      'JING','GELAO','EVENKI','SALAR','KYRGYZ','SHUI','CHUANQING','OTHER','GE','GEJIA'
    ) NULL,
    MODIFY COLUMN `political_status`
    ENUM(
      'NON_PARTY','CPC_MEMBER','CPC_PROBATIONARY_MEMBER','CYL_MEMBER','CDF_MEMBER','CDL_MEMBER',
      'CDCA_MEMBER','CAPD_MEMBER','CPWDP_MEMBER','ZGD_MEMBER','JDS_MEMBER','TML_MEMBER',
      'NONPARTISAN','OTHER'
    ) NULL,
    MODIFY COLUMN `marital_status`
    ENUM('UNMARRIED','MARRIED','DIVORCED','WIDOWED') NULL,
    ADD COLUMN `household_type`
    ENUM('LOCAL_RURAL','LOCAL_URBAN','NONLOCAL_RURAL','NONLOCAL_URBAN') NULL,
    ADD COLUMN `bank_name` ENUM('ICBC') NULL,
    ADD COLUMN `bank_branch_name` VARCHAR(191) NULL,
    ADD COLUMN `bank_account_number` VARCHAR(19) NULL;

ALTER TABLE `employee_assignments`
    ADD COLUMN `personnel_position_id` VARCHAR(191) NULL,
    ADD COLUMN `employee_level_id` VARCHAR(191) NULL,
    ADD COLUMN `employing_company_id` VARCHAR(191) NULL,
    ADD COLUMN `personnel_category` ENUM('TALENT_PROGRAM','NON_TALENT_PROGRAM') NULL,
    ADD COLUMN `employment_relationship` ENUM('INTERNAL_EMPLOYEE','INTERN','LABOR_WORKER') NULL,
    ADD COLUMN `personnel_source` ENUM('SOCIAL_RECRUITMENT','INTERNAL_REFERRAL','HEADHUNTER_REFERRAL','OTHER') NULL,
    ADD INDEX `employee_assignments_personnel_position_id_status_idx`(`personnel_position_id`, `status`),
    ADD INDEX `employee_assignments_employee_level_id_status_idx`(`employee_level_id`, `status`),
    ADD INDEX `employee_assignments_employing_company_id_status_idx`(`employing_company_id`, `status`);

ALTER TABLE `employee_education_experiences`
    MODIFY COLUMN `education_level`
    ENUM(
      'DOCTORAL','MASTER','MBA','BACHELOR','DUAL_BACHELOR','ASSOCIATE_DEGREE',
      'OVERSEAS_HIGHER_EDUCATION','SECONDARY_TECHNICAL','HIGH_SCHOOL','JUNIOR_HIGH_OR_BELOW'
    ) NOT NULL,
    ADD COLUMN `institution_type`
    ENUM(
      'RANK_985','RANK_211','OVERSEAS_TOP_200','OVERSEAS_BEYOND_TOP_100',
      'NATIONAL_UNIFIED_BACHELOR','THIRD_TIER_OR_PRIVATE_BACHELOR','NON_UNIFIED_BACHELOR'
    ) NULL;

CREATE TABLE `employee_field_change_logs` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NULL,
    `changed_field` VARCHAR(191) NOT NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `changed_by_id` VARCHAR(191) NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `employee_field_change_logs_employee_id_changed_at_idx`(`employee_id`, `changed_at`),
    INDEX `employee_field_change_logs_assignment_id_changed_at_idx`(`assignment_id`, `changed_at`),
    INDEX `employee_field_change_logs_changed_by_id_changed_at_idx`(`changed_by_id`, `changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `employee_assignments`
    ADD CONSTRAINT `employee_assignments_personnel_position_id_fkey`
      FOREIGN KEY (`personnel_position_id`) REFERENCES `personnel_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `employee_assignments_employee_level_id_fkey`
      FOREIGN KEY (`employee_level_id`) REFERENCES `employee_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `employee_assignments_employing_company_id_fkey`
      FOREIGN KEY (`employing_company_id`) REFERENCES `employing_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_field_change_logs`
    ADD CONSTRAINT `employee_field_change_logs_employee_id_fkey`
      FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `employee_field_change_logs_assignment_id_fkey`
      FOREIGN KEY (`assignment_id`) REFERENCES `employee_assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `employee_field_change_logs_changed_by_id_fkey`
      FOREIGN KEY (`changed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `personnel_positions`
  (`id`, `code`, `name`, `sort_order`, `created_at`, `updated_at`)
VALUES
  ('personnel-position-front-office', 'FRONT_OFFICE', '前台', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('personnel-position-middle-office', 'MIDDLE_OFFICE', '中台', 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('personnel-position-back-office', 'BACK_OFFICE', '后台', 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `employee_levels`
  (`id`, `code`, `name`, `rank_order`, `created_at`, `updated_at`)
VALUES
  ('employee-level-staff', 'STAFF', '员工级', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employee-level-supervisor', 'SUPERVISOR', '主管级', 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employee-level-manager', 'MANAGER', '经理级', 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employee-level-director', 'DIRECTOR', '总监级', 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employee-level-president', 'PRESIDENT', '总裁级', 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employee-level-expert', 'EXPERT', '专家级', 6, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `employing_companies`
  (`id`, `code`, `name`, `sort_order`, `created_at`, `updated_at`)
VALUES
  ('employing-company-001', 'COMPANY_001', '北京严真网络技术有限公司', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-002', 'COMPANY_002', '北京商路同达广告有限公司', 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-003', 'COMPANY_003', '北京宜信科创技术有限公司', 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-004', 'COMPANY_004', '上海宜信商智人工智能科技有限公司北京分公司', 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-005', 'COMPANY_005', '上海张裕宜信数字科技有限公司北京分公司', 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-006', 'COMPANY_006', '上海宜信电子商务有限公司', 6, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-007', 'COMPANY_007', '上海宜信商智人工智能科技有限公司', 7, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-008', 'COMPANY_008', '天津宜信电子商务有限公司', 8, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-009', 'COMPANY_009', '北京宜信科创技术有限公司杭州分公司', 9, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-010', 'COMPANY_010', '北京宜信科创技术有限公司固安分公司', 10, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-011', 'COMPANY_011', '北京宜信科创技术有限公司杭州分公司-南京', 11, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-012', 'COMPANY_012', '北京宜信科创技术有限公司杭州分公司-广州', 12, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-013', 'COMPANY_013', '北京宜信智能科技有限公司', 13, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-014', 'COMPANY_014', '上海宜信鲜汇电子商务有限公司', 14, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-015', 'COMPANY_015', '兴良汇（北京）贸易发展有限公司', 15, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-016', 'COMPANY_016', '天津宜信鲜汇电子商务有限公司', 16, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-017', 'COMPANY_017', '天津宜信智能科技有限公司北京分公司', 17, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-018', 'COMPANY_018', '上海宜信名汇电子商务有限公司', 18, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-019', 'COMPANY_019', '北京商路同达广告有限公司南京分公司', 19, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-020', 'COMPANY_020', '北京宜信科创技术有限公司杭州分公司-深圳', 20, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-021', 'COMPANY_021', '上海张裕宜信数字科技有限公司', 21, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-022', 'COMPANY_022', 'ADVINSYS PTY LIMITED', 22, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-023', 'COMPANY_023', '宜信电商有限公司', 23, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-024', 'COMPANY_024', '上海宜信商智人工智能科技有限公司深圳分公司', 24, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-025', 'COMPANY_025', '上海心术通识科技有限公司', 25, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-026', 'COMPANY_026', '上海心术通识科技有限公司北京分公司', 26, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('employing-company-027', 'COMPANY_027', '上海心术通识科技有限公司杭州分公司', 27, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
