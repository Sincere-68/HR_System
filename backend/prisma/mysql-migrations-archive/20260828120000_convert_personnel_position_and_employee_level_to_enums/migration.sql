-- Correct the previous personnel-page migration without rewriting migration history.
-- Validate before permanent DDL. The table is session-local and its primary key
-- makes any non-null legacy relation without a confirmed source code fail with
-- a duplicate-key error. This does not depend on SQL mode or CHECK enforcement.

CREATE TEMPORARY TABLE `employee_assignment_fixed_enum_validation` (
    `id` TINYINT NOT NULL,
    PRIMARY KEY (`id`)
);

INSERT INTO `employee_assignment_fixed_enum_validation` (`id`) VALUES (1);

INSERT INTO `employee_assignment_fixed_enum_validation` (`id`)
SELECT 1
WHERE EXISTS (
    SELECT 1
    FROM `employee_assignments` AS `assignment`
    LEFT JOIN `personnel_positions` AS `position`
      ON `position`.`id` = `assignment`.`personnel_position_id`
    WHERE `assignment`.`personnel_position_id` IS NOT NULL
      AND (
        `position`.`id` IS NULL
        OR `position`.`code` NOT IN ('FRONT_OFFICE', 'MIDDLE_OFFICE', 'BACK_OFFICE')
      )
)
OR EXISTS (
    SELECT 1
    FROM `employee_assignments` AS `assignment`
    LEFT JOIN `employee_levels` AS `level`
      ON `level`.`id` = `assignment`.`employee_level_id`
    WHERE `assignment`.`employee_level_id` IS NOT NULL
      AND (
        `level`.`id` IS NULL
        OR `level`.`code` NOT IN ('STAFF', 'SUPERVISOR', 'MANAGER', 'DIRECTOR', 'PRESIDENT', 'EXPERT')
      )
);

DROP TEMPORARY TABLE `employee_assignment_fixed_enum_validation`;

-- Historical assignments without a source value remain NULL; no value is inferred.
ALTER TABLE `employee_assignments`
    ADD COLUMN `personnel_position`
      ENUM('FRONT_OFFICE', 'MIDDLE_OFFICE', 'BACK_OFFICE') NULL,
    ADD COLUMN `employee_level`
      ENUM('STAFF', 'SUPERVISOR', 'MANAGER', 'DIRECTOR', 'PRESIDENT', 'EXPERT') NULL;

UPDATE `employee_assignments` AS `assignment`
INNER JOIN `personnel_positions` AS `position`
  ON `position`.`id` = `assignment`.`personnel_position_id`
SET `assignment`.`personnel_position` = `position`.`code`
WHERE `assignment`.`personnel_position_id` IS NOT NULL;

UPDATE `employee_assignments` AS `assignment`
INNER JOIN `employee_levels` AS `level`
  ON `level`.`id` = `assignment`.`employee_level_id`
SET `assignment`.`employee_level` = `level`.`code`
WHERE `assignment`.`employee_level_id` IS NOT NULL;

ALTER TABLE `employee_assignments`
    DROP FOREIGN KEY `employee_assignments_personnel_position_id_fkey`,
    DROP FOREIGN KEY `employee_assignments_employee_level_id_fkey`,
    DROP INDEX `employee_assignments_personnel_position_id_status_idx`,
    DROP INDEX `employee_assignments_employee_level_id_status_idx`,
    DROP COLUMN `personnel_position_id`,
    DROP COLUMN `employee_level_id`,
    ADD INDEX `employee_assignments_personnel_position_status_idx` (`personnel_position`, `status`),
    ADD INDEX `employee_assignments_employee_level_status_idx` (`employee_level`, `status`);

DROP TABLE `personnel_positions`;
DROP TABLE `employee_levels`;
