DO $$
DECLARE
  duplicate_groups text;
BEGIN
  SELECT string_agg(
    format('%s (patient IDs: %s)', normalized_name, array_to_string(patient_ids, ', ')),
    '; '
  )
  INTO duplicate_groups
  FROM (
    SELECT
      lower(btrim(regexp_replace("fullName", '[[:space:]]+', ' ', 'g'))) AS normalized_name,
      array_agg(id ORDER BY id) AS patient_ids
    FROM patients
    GROUP BY lower(btrim(regexp_replace("fullName", '[[:space:]]+', ' ', 'g')))
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_groups IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce unique normalized patient names until duplicate records are reviewed: %',
      duplicate_groups
      USING ERRCODE = '23505';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX patients_full_name_normalized_unique
ON patients (lower(btrim(regexp_replace("fullName", '[[:space:]]+', ' ', 'g'))));
