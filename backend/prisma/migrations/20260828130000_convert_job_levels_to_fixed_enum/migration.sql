-- Convert the legacy JobLevel directory relation to a fixed enum code.
-- Validate every non-null source before permanent DDL. The sentinel insert
-- deliberately fails with a duplicate primary key when an unsupported code or
-- missing directory row is found; this avoids relying on CHECK enforcement.

CREATE TEMPORARY TABLE `employee_job_level_fixed_enum_validation` (
    `id` TINYINT NOT NULL,
    PRIMARY KEY (`id`)
);

INSERT INTO `employee_job_level_fixed_enum_validation` (`id`) VALUES (1);

INSERT INTO `employee_job_level_fixed_enum_validation` (`id`)
SELECT 1
FROM `employee_assignments` AS `assignment`
LEFT JOIN `job_levels` AS `level`
  ON `level`.`id` = `assignment`.`job_level_id`
WHERE `assignment`.`job_level_id` IS NOT NULL
  AND (
    `level`.`id` IS NULL
    OR `level`.`code` NOT IN (
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7',
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'
    )
  )
LIMIT 1;

INSERT INTO `employee_job_level_fixed_enum_validation` (`id`)
SELECT 1
FROM `employee_movements` AS `movement`
LEFT JOIN `job_levels` AS `level`
  ON `level`.`id` = `movement`.`from_job_level_id`
WHERE `movement`.`from_job_level_id` IS NOT NULL
  AND (
    `level`.`id` IS NULL
    OR `level`.`code` NOT IN (
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7',
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'
    )
  )
LIMIT 1;

INSERT INTO `employee_job_level_fixed_enum_validation` (`id`)
SELECT 1
FROM `employee_movements` AS `movement`
LEFT JOIN `job_levels` AS `level`
  ON `level`.`id` = `movement`.`to_job_level_id`
WHERE `movement`.`to_job_level_id` IS NOT NULL
  AND (
    `level`.`id` IS NULL
    OR `level`.`code` NOT IN (
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7',
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'
    )
  )
LIMIT 1;

DROP TEMPORARY TABLE `employee_job_level_fixed_enum_validation`;

ALTER TABLE `employee_assignments`
    ADD COLUMN `job_level`
      ENUM(
        'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
        'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7',
        'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
        'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'
      ) NULL;

ALTER TABLE `employee_movements`
    ADD COLUMN `from_job_level`
      ENUM(
        'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
        'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7',
        'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
        'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'
      ) NULL,
    ADD COLUMN `to_job_level`
      ENUM(
        'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
        'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7',
        'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
        'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'
      ) NULL;

UPDATE `employee_assignments` AS `assignment`
INNER JOIN `job_levels` AS `level`
  ON `level`.`id` = `assignment`.`job_level_id`
SET `assignment`.`job_level` = `level`.`code`
WHERE `assignment`.`job_level_id` IS NOT NULL;

UPDATE `employee_movements` AS `movement`
INNER JOIN `job_levels` AS `level`
  ON `level`.`id` = `movement`.`from_job_level_id`
SET `movement`.`from_job_level` = `level`.`code`
WHERE `movement`.`from_job_level_id` IS NOT NULL;

UPDATE `employee_movements` AS `movement`
INNER JOIN `job_levels` AS `level`
  ON `level`.`id` = `movement`.`to_job_level_id`
SET `movement`.`to_job_level` = `level`.`code`
WHERE `movement`.`to_job_level_id` IS NOT NULL;

ALTER TABLE `employee_assignments`
    DROP FOREIGN KEY `employee_assignments_job_level_id_fkey`,
    DROP COLUMN `job_level_id`,
    ADD INDEX `employee_assignments_job_level_status_idx` (`job_level`, `status`);

ALTER TABLE `employee_movements`
    DROP FOREIGN KEY `employee_movements_from_job_level_id_fkey`,
    DROP FOREIGN KEY `employee_movements_to_job_level_id_fkey`,
    DROP COLUMN `from_job_level_id`,
    DROP COLUMN `to_job_level_id`;

DROP TABLE `job_levels`;
