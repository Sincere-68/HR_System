-- Intentionally discard the three retired detail fields. The user explicitly
-- chose not to copy their historical values into the replacement fields.
ALTER TABLE "employees"
  DROP COLUMN "native_place",
  DROP COLUMN "household_address",
  DROP COLUMN "residential_address";
