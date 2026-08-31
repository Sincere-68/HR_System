-- Move the internal full-time company from department assignments to contract
-- agreements. The new agreement relation is nullable so historical rows that
-- cannot be safely resolved remain queryable as NULL rather than receiving an
-- inferred company.

ALTER TABLE `employee_agreements`
    ADD COLUMN `employing_company_id` VARCHAR(191) NULL,
    ADD INDEX `employee_agreements_employing_company_id_status_idx` (`employing_company_id`, `status`);

ALTER TABLE `employee_agreements`
    ADD CONSTRAINT `employee_agreements_employing_company_id_fkey`
      FOREIGN KEY (`employing_company_id`) REFERENCES `employing_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- PRE-EXECUTION / MIGRATION AUDIT
-- Review this result before treating the migration as complete. Rows returned
-- below have no non-null company on a primary assignment in the same employment
-- period, so they intentionally remain NULL after the backfill. Do not use an
-- organization name or any external-work-experience company as a substitute.
SELECT
    `agreement`.`id` AS `agreement_id`,
    `agreement`.`employee_id`,
    `agreement`.`employment_period_id`,
    `agreement`.`start_date`
FROM `employee_agreements` AS `agreement`
WHERE `agreement`.`employing_company_id` IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `employee_assignments` AS `assignment`
    WHERE `assignment`.`employee_id` = `agreement`.`employee_id`
      AND `assignment`.`employment_period_id` <=> `agreement`.`employment_period_id`
      AND `assignment`.`is_primary` = true
      AND `assignment`.`employing_company_id` IS NOT NULL
  );

-- Prefer the primary assignment covering the agreement effective date. If no
-- such assignment exists, fall back only to the latest primary assignment in
-- the same employee and employment period. Both choices require an existing
-- source company; no source leaves the agreement value NULL.
UPDATE `employee_agreements` AS `agreement`
SET `agreement`.`employing_company_id` = COALESCE(
    (
        SELECT `assignment`.`employing_company_id`
        FROM `employee_assignments` AS `assignment`
        WHERE `assignment`.`employee_id` = `agreement`.`employee_id`
          AND `assignment`.`employment_period_id` <=> `agreement`.`employment_period_id`
          AND `assignment`.`is_primary` = true
          AND `assignment`.`employing_company_id` IS NOT NULL
          AND `assignment`.`start_date` <= `agreement`.`start_date`
          AND (`assignment`.`end_date` IS NULL OR `assignment`.`end_date` >= `agreement`.`start_date`)
        ORDER BY `assignment`.`start_date` DESC, `assignment`.`id` ASC
        LIMIT 1
    ),
    (
        SELECT `assignment`.`employing_company_id`
        FROM `employee_assignments` AS `assignment`
        WHERE `assignment`.`employee_id` = `agreement`.`employee_id`
          AND `assignment`.`employment_period_id` <=> `agreement`.`employment_period_id`
          AND `assignment`.`is_primary` = true
          AND `assignment`.`employing_company_id` IS NOT NULL
        ORDER BY `assignment`.`start_date` DESC, `assignment`.`id` ASC
        LIMIT 1
    )
)
WHERE `agreement`.`employing_company_id` IS NULL;

-- The source has been copied without modifying organizations or the employing
-- company directory. Remove only the obsolete assignment relationship.
ALTER TABLE `employee_assignments`
    DROP FOREIGN KEY `employee_assignments_employing_company_id_fkey`,
    DROP INDEX `employee_assignments_employing_company_id_status_idx`,
    DROP COLUMN `employing_company_id`;

-- Remove the obsolete contract signing-organization relationship only after the
-- replacement agreement company relation and history backfill are in place.
ALTER TABLE `employee_agreements`
    DROP FOREIGN KEY `employee_agreements_signing_organization_id_fkey`,
    DROP INDEX `employee_agreements_signing_organization_id_status_idx`,
    DROP COLUMN `signing_organization_id`;
