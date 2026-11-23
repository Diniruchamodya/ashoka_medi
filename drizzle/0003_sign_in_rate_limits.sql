CREATE TABLE sign_in_rate_limits (
  scope text NOT NULL CHECK (scope IN ('email_ip', 'ip')),
  "keyHash" text NOT NULL,
  "failureCount" integer NOT NULL CHECK ("failureCount" BETWEEN 1 AND 5),
  "windowStartedAt" timestamptz NOT NULL DEFAULT now(),
  "lockedUntil" timestamptz,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, "keyHash")
);
--> statement-breakpoint
CREATE INDEX sign_in_rate_limits_updated_idx
ON sign_in_rate_limits ("updatedAt");
