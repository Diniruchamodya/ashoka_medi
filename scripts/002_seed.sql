INSERT INTO branches (name, code, address, phone) VALUES
  ('Colombo Main', 'CMB', '125 Galle Road, Colombo 03', '011 234 5678'),
  ('Kandy', 'KDY', '42 Peradeniya Road, Kandy', '081 222 3344'),
  ('Galle', 'GLE', '18 Wakwella Road, Galle', '091 223 4455'),
  ('Negombo', 'NGB', '76 Main Street, Negombo', '031 222 5566')
ON CONFLICT (code) DO NOTHING;

INSERT INTO test_categories (name, description) VALUES
  ('Haematology', 'Blood cell counts and coagulation studies'),
  ('Biochemistry', 'Metabolic panels, lipids, liver and renal function'),
  ('Endocrinology', 'Hormone and thyroid investigations'),
  ('Microbiology', 'Cultures and infectious disease screening'),
  ('Urine & Stool', 'Routine urine and stool analysis'),
  ('Immunology', 'Serology and immune markers')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lab_partners (name, "contactPerson", phone, email, address)
SELECT * FROM (VALUES
  ('Lanka Genomics Reference Lab', 'Dr. Nirmala Perera', '011 255 7788', 'referrals@lankagenomics.lk', 'Colombo 07'),
  ('Central Pathology Services', 'Mr. Kasun Silva', '011 244 9900', 'lab@centralpath.lk', 'Nugegoda')
) AS v(name, "contactPerson", phone, email, address)
WHERE NOT EXISTS (SELECT 1 FROM lab_partners);

INSERT INTO tests ("categoryId", code, name, price, "sampleType", "turnaroundHours", "partnerId")
SELECT c.id, v.code, v.name, v.price, v."sampleType", v.tat, p.id
FROM (VALUES
  ('Haematology', 'FBC', 'Full Blood Count', 1200.00, 'EDTA Blood', 4, NULL),
  ('Haematology', 'ESR', 'Erythrocyte Sedimentation Rate', 450.00, 'EDTA Blood', 2, NULL),
  ('Haematology', 'PTINR', 'Prothrombin Time / INR', 1500.00, 'Citrate Blood', 6, NULL),
  ('Biochemistry', 'FBS', 'Fasting Blood Sugar', 400.00, 'Fluoride Blood', 2, NULL),
  ('Biochemistry', 'HBA1C', 'HbA1c', 2200.00, 'EDTA Blood', 24, NULL),
  ('Biochemistry', 'LIPID', 'Lipid Profile', 2500.00, 'Serum', 6, NULL),
  ('Biochemistry', 'LFT', 'Liver Function Test', 3200.00, 'Serum', 8, NULL),
  ('Biochemistry', 'SCR', 'Serum Creatinine', 650.00, 'Serum', 4, NULL),
  ('Endocrinology', 'TSH', 'Thyroid Stimulating Hormone', 2400.00, 'Serum', 24, NULL),
  ('Endocrinology', 'VITD', 'Vitamin D (25-OH)', 5800.00, 'Serum', 72, 'Lanka Genomics Reference Lab'),
  ('Microbiology', 'UCS', 'Urine Culture & ABST', 2800.00, 'Urine', 72, NULL),
  ('Microbiology', 'DENG', 'Dengue NS1 Antigen', 2600.00, 'Serum', 4, NULL),
  ('Urine & Stool', 'UFR', 'Urine Full Report', 500.00, 'Urine', 2, NULL),
  ('Urine & Stool', 'SFR', 'Stool Full Report', 600.00, 'Stool', 4, NULL),
  ('Immunology', 'CRP', 'C-Reactive Protein', 1400.00, 'Serum', 4, NULL),
  ('Immunology', 'ANA', 'Antinuclear Antibody', 4500.00, 'Serum', 96, 'Central Pathology Services')
) AS v(category, code, name, price, "sampleType", tat, partner)
JOIN test_categories c ON c.name = v.category
LEFT JOIN lab_partners p ON p.name = v.partner
ON CONFLICT (code) DO NOTHING;

INSERT INTO doctors (name, specialty, hospital, phone, email)
SELECT * FROM (VALUES
  ('Dr. Anura Jayasinghe', 'General Physician', 'Asiri Hospital', '077 123 4567', 'anura.j@example.lk'),
  ('Dr. Shalini Fernando', 'Endocrinologist', 'Nawaloka Hospital', '071 234 5678', 'shalini.f@example.lk'),
  ('Dr. Ruwan Wickramasinghe', 'Cardiologist', 'Lanka Hospitals', '076 345 6789', 'ruwan.w@example.lk'),
  ('Dr. Dilani Rathnayake', 'Paediatrician', 'Kandy General Hospital', '070 456 7890', 'dilani.r@example.lk')
) AS v(name, specialty, hospital, phone, email)
WHERE NOT EXISTS (SELECT 1 FROM doctors);

INSERT INTO order_templates (name, description, "testIds")
SELECT v.name, v.description, ARRAY(SELECT id FROM tests WHERE code = ANY(v.codes) ORDER BY id)
FROM (VALUES
  ('Annual Health Check', 'Routine wellness screening', ARRAY['FBC','FBS','LIPID','LFT','SCR','UFR']),
  ('Diabetes Monitoring', 'Glycaemic control follow-up', ARRAY['FBS','HBA1C','SCR']),
  ('Fever Workup', 'Acute febrile illness screen', ARRAY['FBC','DENG','CRP','UFR'])
) AS v(name, description, codes)
WHERE NOT EXISTS (SELECT 1 FROM order_templates);
