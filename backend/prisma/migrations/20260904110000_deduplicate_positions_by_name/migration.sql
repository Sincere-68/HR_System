-- The confirmation catalog defines Position by name. Before making names unique,
-- preserve every business reference by redirecting duplicate IDs to one stable ID.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        plan.organization_id,
        canonical.id AS canonical_position_id,
        plan.plan_year,
        COUNT(*) AS plan_count
      FROM staffing_plans AS plan
      INNER JOIN positions AS duplicate ON duplicate.id = plan.position_id
      INNER JOIN LATERAL (
        SELECT id
        FROM positions AS candidate
        WHERE candidate.name = duplicate.name
        ORDER BY candidate.created_at ASC, candidate.id ASC
        LIMIT 1
      ) AS canonical ON true
      GROUP BY plan.organization_id, canonical.id, plan.plan_year
      HAVING COUNT(*) > 1
    ) AS collisions
  ) THEN
    RAISE EXCEPTION 'Position name consolidation would create duplicate staffing plans; resolve conflicting organization/year plans before migrating.';
  END IF;
END $$;

CREATE TEMP TABLE position_name_canonical AS
SELECT
  duplicate.id AS duplicate_id,
  canonical.id AS canonical_id
FROM positions AS duplicate
INNER JOIN LATERAL (
  SELECT id
  FROM positions AS candidate
  WHERE candidate.name = duplicate.name
  ORDER BY candidate.created_at ASC, candidate.id ASC
  LIMIT 1
) AS canonical ON true
WHERE duplicate.id <> canonical.id;

UPDATE employee_assignments AS row
SET position_id = mapping.canonical_id
FROM position_name_canonical AS mapping
WHERE row.position_id = mapping.duplicate_id;

UPDATE offers AS row
SET position_id = mapping.canonical_id
FROM position_name_canonical AS mapping
WHERE row.position_id = mapping.duplicate_id;

UPDATE employee_movements AS row
SET from_position_id = mapping.canonical_id
FROM position_name_canonical AS mapping
WHERE row.from_position_id = mapping.duplicate_id;

UPDATE employee_movements AS row
SET to_position_id = mapping.canonical_id
FROM position_name_canonical AS mapping
WHERE row.to_position_id = mapping.duplicate_id;

UPDATE trial_post_records AS row
SET target_position_id = mapping.canonical_id
FROM position_name_canonical AS mapping
WHERE row.target_position_id = mapping.duplicate_id;

UPDATE staffing_plans AS row
SET position_id = mapping.canonical_id
FROM position_name_canonical AS mapping
WHERE row.position_id = mapping.duplicate_id;

UPDATE performance_module_tasks AS task
SET executor_directory_id = mapping.canonical_id
FROM position_name_canonical AS mapping
WHERE task.executor_directory_type = 'POSITION'
  AND task.executor_directory_id = mapping.duplicate_id;

CREATE OR REPLACE FUNCTION pg_temp.replace_position_ids(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  text_value text;
BEGIN
  CASE jsonb_typeof(value)
    WHEN 'object' THEN
      SELECT COALESCE(jsonb_object_agg(key, pg_temp.replace_position_ids(item)), '{}'::jsonb)
      INTO result
      FROM jsonb_each(value) AS entry(key, item);
    WHEN 'array' THEN
      SELECT COALESCE(jsonb_agg(pg_temp.replace_position_ids(item)), '[]'::jsonb)
      INTO result
      FROM jsonb_array_elements(value) AS item;
    WHEN 'string' THEN
      text_value := value #>> '{}';
      SELECT to_jsonb(COALESCE(mapping.canonical_id, text_value))
      INTO result
      FROM (SELECT 1) AS placeholder
      LEFT JOIN position_name_canonical AS mapping ON mapping.duplicate_id = text_value;
    ELSE
      result := value;
  END CASE;
  RETURN result;
END;
$$;

UPDATE performance_template_versions
SET definition = pg_temp.replace_position_ids(definition);

UPDATE performance_instances
SET definition_snapshot = pg_temp.replace_position_ids(definition_snapshot);

UPDATE performance_module_tasks
SET module_snapshot = pg_temp.replace_position_ids(module_snapshot);

DROP FUNCTION pg_temp.replace_position_ids(jsonb);

DELETE FROM positions AS duplicate
USING position_name_canonical AS mapping
WHERE duplicate.id = mapping.duplicate_id;

DROP INDEX IF EXISTS "positions_code_key";
ALTER TABLE "positions" DROP COLUMN IF EXISTS "code";
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");
