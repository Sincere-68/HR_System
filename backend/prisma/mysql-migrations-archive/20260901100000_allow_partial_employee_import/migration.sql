-- Import-only employee rows may contain only the business fields present in a
-- file. The regular employee creation API remains responsible for enforcing
-- complete onboarding and assignment data.
ALTER TABLE `employees`
    MODIFY COLUMN `name` VARCHAR(191) NULL,
    MODIFY COLUMN `mobile` VARCHAR(191) NULL,
    MODIFY COLUMN `organization_id` VARCHAR(191) NULL;
