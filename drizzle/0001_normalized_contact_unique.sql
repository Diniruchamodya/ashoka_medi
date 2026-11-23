DO $$
DECLARE
  duplicate_groups text;
BEGIN
  SELECT string_agg(
    format('%s.%s record IDs [%s]', entity, field, array_to_string(record_ids, ', ')),
    '; '
  )
  INTO duplicate_groups
  FROM (
    WITH normalized_records AS (
      SELECT 'patients' AS entity, 'phone' AS field, id AS record_id,
             CASE WHEN compact ~ '^[+]94[0-9]{9}$' THEN '0' || substring(compact from 4) ELSE compact END AS normalized_value
      FROM (
        SELECT id, regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') AS compact
        FROM patients WHERE nullif(btrim(phone), '') IS NOT NULL
      ) patient_phones
      UNION ALL
      SELECT 'patients', 'email', id, lower(btrim(email))
      FROM patients WHERE nullif(btrim(email), '') IS NOT NULL
      UNION ALL
      SELECT 'doctors', 'name', id, lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
      FROM doctors
      UNION ALL
      SELECT 'doctors', 'phone', id,
             CASE WHEN compact ~ '^[+]94[0-9]{9}$' THEN '0' || substring(compact from 4) ELSE compact END
      FROM (
        SELECT id, regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') AS compact
        FROM doctors WHERE nullif(btrim(phone), '') IS NOT NULL
      ) doctor_phones
      UNION ALL
      SELECT 'doctors', 'email', id, lower(btrim(email))
      FROM doctors WHERE nullif(btrim(email), '') IS NOT NULL
      UNION ALL
      SELECT 'labPartners', 'name', id, lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
      FROM lab_partners
      UNION ALL
      SELECT 'labPartners', 'phone', id,
             CASE WHEN compact ~ '^[+]94[0-9]{9}$' THEN '0' || substring(compact from 4) ELSE compact END
      FROM (
        SELECT id, regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') AS compact
        FROM lab_partners WHERE nullif(btrim(phone), '') IS NOT NULL
      ) partner_phones
      UNION ALL
      SELECT 'labPartners', 'email', id, lower(btrim(email))
      FROM lab_partners WHERE nullif(btrim(email), '') IS NOT NULL
    )
    SELECT entity, field, array_agg(record_id ORDER BY record_id) AS record_ids
    FROM normalized_records
    GROUP BY entity, field, normalized_value
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_groups IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create normalized contact indexes until duplicate records are reviewed: %',
      duplicate_groups
      USING ERRCODE = '23505';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX patients_phone_normalized_unique
ON patients (
  CASE
    WHEN regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') ~ '^[+]94[0-9]{9}$'
    THEN '0' || substring(regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') from 4)
    ELSE regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g')
  END
)
WHERE nullif(btrim(phone), '') IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX patients_email_normalized_unique
ON patients (lower(btrim(email)))
WHERE nullif(btrim(email), '') IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX doctors_name_normalized_unique
ON doctors (lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))));
--> statement-breakpoint
CREATE UNIQUE INDEX doctors_phone_normalized_unique
ON doctors (
  CASE
    WHEN regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') ~ '^[+]94[0-9]{9}$'
    THEN '0' || substring(regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') from 4)
    ELSE regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g')
  END
)
WHERE nullif(btrim(phone), '') IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX doctors_email_normalized_unique
ON doctors (lower(btrim(email)))
WHERE nullif(btrim(email), '') IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX lab_partners_name_normalized_unique
ON lab_partners (lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))));
--> statement-breakpoint
CREATE UNIQUE INDEX lab_partners_phone_normalized_unique
ON lab_partners (
  CASE
    WHEN regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') ~ '^[+]94[0-9]{9}$'
    THEN '0' || substring(regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g') from 4)
    ELSE regexp_replace(coalesce(phone, ''), '[-[:space:]()]', '', 'g')
  END
)
WHERE nullif(btrim(phone), '') IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX lab_partners_email_normalized_unique
ON lab_partners (lower(btrim(email)))
WHERE nullif(btrim(email), '') IS NOT NULL;
