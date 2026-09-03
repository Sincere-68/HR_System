-- Add GB/T 2260-compatible administrative-region codes without changing or
-- attempting to infer existing free-text birthplace and address values.
ALTER TABLE `employees`
  ADD COLUMN `native_place_region_code` VARCHAR(12) NULL,
  ADD COLUMN `household_region_code` VARCHAR(12) NULL,
  ADD COLUMN `residential_region_code` VARCHAR(12) NULL;
