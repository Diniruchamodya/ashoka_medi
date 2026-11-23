ALTER TABLE tests
ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS report_templates (
  id serial PRIMARY KEY,
  "testId" integer NOT NULL UNIQUE REFERENCES tests(id) ON DELETE CASCADE,
  configuration jsonb NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS report_template_visibility (
  "testId" integer PRIMARY KEY REFERENCES tests(id) ON DELETE CASCADE,
  hidden boolean NOT NULL DEFAULT false,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
