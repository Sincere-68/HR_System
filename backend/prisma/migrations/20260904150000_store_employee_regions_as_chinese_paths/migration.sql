-- Store personnel administrative regions as canonical Chinese paths for API, form,
-- import, and display use. Legacy code columns remain unchanged for compatibility.
-- Existing codes are converted to Chinese at read time by the application until
-- a later Chinese-path import or edit writes the new columns; unknown codes are
-- never guessed during this structural migration.
ALTER TABLE "employees"
  ADD COLUMN "native_place_region_name" TEXT,
  ADD COLUMN "household_region_name" TEXT,
  ADD COLUMN "residential_region_name" TEXT;
