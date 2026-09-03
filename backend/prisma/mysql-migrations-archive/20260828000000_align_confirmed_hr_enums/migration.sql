-- Align legacy columns with the confirmed HR enum contract.
-- This migration is intentionally not executed in this change. Review the
-- generated SQL and take a database backup before applying it.

-- Normalize legacy gender values while their old enum still accepts OTHER,
-- then narrow both columns only after the data is representable by the final
-- three-value contract.
UPDATE `employees`
SET `gender` = 'UNDISCLOSED'
WHERE `gender` = 'OTHER';

UPDATE `employee_family_members`
SET `gender` = 'UNDISCLOSED'
WHERE `gender` = 'OTHER';

-- Existing ACTIVE/INACTIVE employment records map to the new business
-- statuses. The temporary legacy values below make the data update safe before
-- the column is narrowed to the final eight values. Preserve final-contract
-- values as-is so this transform remains safe if a database was prepared
-- before this migration was recorded.
ALTER TABLE `employment_records`
    MODIFY COLUMN `status`
    ENUM(
      'ACTIVE',
      'INACTIVE',
      'PROBATION',
      'REGULAR',
      'PENDING_ENTRY',
      'TRANSFERRED_OUT',
      'PENDING_TRANSFER_IN',
      'RETIRED',
      'RESIGNED',
      'NON_REGULAR'
    ) NOT NULL;

UPDATE `employment_records`
SET `status` = CASE
  WHEN `status` = 'ACTIVE' THEN 'REGULAR'
  WHEN `status` = 'INACTIVE' THEN 'RESIGNED'
  ELSE `status`
END;

ALTER TABLE `employment_records`
    MODIFY COLUMN `status`
    ENUM(
      'PROBATION',
      'REGULAR',
      'PENDING_ENTRY',
      'TRANSFERRED_OUT',
      'PENDING_TRANSFER_IN',
      'RETIRED',
      'RESIGNED',
      'NON_REGULAR'
    ) NOT NULL;

ALTER TABLE `employment_periods`
    ADD COLUMN `personnel_category`
      ENUM('TALENT_PROGRAM', 'NON_TALENT_PROGRAM') NULL,
    ADD COLUMN `personnel_source`
      ENUM('SOCIAL_RECRUITMENT', 'INTERNAL_REFERRAL', 'HEADHUNTER_REFERRAL', 'OTHER') NULL,
    ADD COLUMN `employment_relationship`
      ENUM('INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER') NULL;

-- Preserve the legacy employee-level relationship before the duplicate column
-- is removed. employee_assignments already gained an independently nullable
-- employment_relationship in 20260827120000, so backfill only rows that have
-- not since received an explicit assignment-level value.
UPDATE `employment_periods` AS ep
JOIN `employees` AS e ON e.`id` = ep.`employee_id`
SET ep.`employment_relationship` = e.`personnel_type`;

UPDATE `employee_assignments` AS ea
JOIN `employees` AS e ON e.`id` = ea.`employee_id`
SET ea.`employment_relationship` = e.`personnel_type`
WHERE ea.`employment_relationship` IS NULL;

ALTER TABLE `employment_periods`
    MODIFY COLUMN `employment_status`
    ENUM(
      'ACTIVE',
      'INACTIVE',
      'PROBATION',
      'REGULAR',
      'PENDING_ENTRY',
      'TRANSFERRED_OUT',
      'PENDING_TRANSFER_IN',
      'RETIRED',
      'RESIGNED',
      'NON_REGULAR'
    ) NOT NULL DEFAULT 'REGULAR';

UPDATE `employment_periods`
SET `employment_status` = CASE
  WHEN `employment_status` = 'ACTIVE' THEN 'REGULAR'
  WHEN `employment_status` = 'INACTIVE' THEN 'RESIGNED'
  ELSE `employment_status`
END;

ALTER TABLE `employment_periods`
    MODIFY COLUMN `employment_status`
    ENUM(
      'PROBATION',
      'REGULAR',
      'PENDING_ENTRY',
      'TRANSFERRED_OUT',
      'PENDING_TRANSFER_IN',
      'RETIRED',
      'RESIGNED',
      'NON_REGULAR'
    ) NOT NULL DEFAULT 'REGULAR';

ALTER TABLE `employment_periods`
    DROP INDEX `employment_periods_personnel_type_employment_status_idx`,
    ADD INDEX `employment_periods_personnel_category_employment_status_idx`
      (`personnel_category`, `employment_status`),
    ADD INDEX `employment_periods_personnel_source_employment_status_idx`
      (`personnel_source`, `employment_status`),
    ADD INDEX `employment_periods_employment_relationship_employment_status_idx`
      (`employment_relationship`, `employment_status`),
    DROP COLUMN `personnel_type`;

-- personnel_category, personnel_source and employment_relationship were added
-- to employee_assignments by 20260827120000. Add only the indexes introduced
-- by the current Prisma schema here; do not attempt to add those columns again.
ALTER TABLE `employee_assignments`
    ADD INDEX `employee_assignments_personnel_category_status_idx`
      (`personnel_category`, `status`),
    ADD INDEX `employee_assignments_employment_relationship_status_idx`
      (`employment_relationship`, `status`);

ALTER TABLE `employment_periods`
    MODIFY COLUMN `employment_relationship`
      ENUM('INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER') NOT NULL;

-- EmployeeAssignment remains nullable because historical assignments may not
-- be unambiguously attributable to one of the three employment relationships.
-- New primary assignments receive the relationship from their employment
-- period in application code.

-- `employees.id_card_no` was only a legacy compatibility value. It is null for
-- non-NATIONAL_ID documents, whose canonical number remains in the document
-- table. The unique index still permits multiple NULL values in MySQL.
ALTER TABLE `employees`
    MODIFY COLUMN `id_card_no` VARCHAR(191) NULL,
    DROP INDEX `employees_personnel_type_record_status_idx`,
    DROP COLUMN `personnel_type`;

ALTER TABLE `offers`
    CHANGE COLUMN `personnel_type` `employment_relationship`
      ENUM('INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER') NOT NULL;

-- Convert assignment lifecycle values without confusing them with the
-- generic RecordStatus used by ordinary records. Retain every legacy value
-- while translating it, then narrow to the two AssignmentStatus values.
ALTER TABLE `employee_assignments`
    MODIFY COLUMN `status`
    ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED', 'ENDED')
    NOT NULL DEFAULT 'ACTIVE';

UPDATE `employee_assignments`
SET `status` = CASE
  WHEN `status` = 'ACTIVE' THEN 'ACTIVE'
  ELSE 'ENDED'
END;

ALTER TABLE `employee_assignments`
    MODIFY COLUMN `status` ENUM('ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE';

-- The preceding migration converts the confirmed test-only FULL_TIME values
-- to CONTRACT_EMPLOYMENT before narrowing work_arrangement to the six
-- HR-approved values. No FULL_TIME compatibility value remains after that
-- migration, so this migration deliberately makes no further change here.

ALTER TABLE `organizations`
    DROP INDEX `organizations_organization_type_status_idx`,
    DROP COLUMN `organization_type`;

ALTER TABLE `employees`
    MODIFY COLUMN `gender` ENUM('MALE', 'FEMALE', 'UNDISCLOSED') NULL;

ALTER TABLE `employee_family_members`
    MODIFY COLUMN `gender` ENUM('MALE', 'FEMALE', 'UNDISCLOSED') NULL;
