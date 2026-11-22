-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  scope text,
  password text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Lab tables
CREATE TABLE IF NOT EXISTS branches (
  id serial PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  phone text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  "userId" text PRIMARY KEY,
  role text NOT NULL DEFAULT 'receptionist',
  "branchIds" integer[] NOT NULL DEFAULT '{}',
  "activeBranchId" integer,
  phone text,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_categories (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_partners (
  id serial PRIMARY KEY,
  name text NOT NULL,
  "contactPerson" text,
  phone text,
  email text,
  address text,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
  id serial PRIMARY KEY,
  "categoryId" integer,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  "sampleType" text,
  "turnaroundHours" integer NOT NULL DEFAULT 24,
  "partnerId" integer,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
  id serial PRIMARY KEY,
  name text NOT NULL,
  specialty text,
  hospital text,
  phone text,
  email text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id serial PRIMARY KEY,
  "patientCode" text NOT NULL UNIQUE,
  "fullName" text NOT NULL,
  gender text,
  "dateOfBirth" date,
  phone text,
  email text,
  nic text,
  address text,
  "branchId" integer,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_templates (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  "testIds" integer[] NOT NULL DEFAULT '{}',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  "orderNumber" text NOT NULL UNIQUE,
  "branchId" integer NOT NULL,
  "patientId" integer NOT NULL,
  "doctorId" integer,
  status text NOT NULL DEFAULT 'pending',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  "paidAmount" numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  "createdBy" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

CREATE INDEX IF NOT EXISTS orders_branch_created_idx ON orders ("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS orders_patient_idx ON orders ("patientId");

CREATE TABLE IF NOT EXISTS order_items (
  id serial PRIMARY KEY,
  "orderId" integer NOT NULL,
  "testId" integer NOT NULL,
  "testName" text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  "partnerId" integer,
  result text,
  "updatedBy" text,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items ("orderId");
CREATE INDEX IF NOT EXISTS order_items_status_idx ON order_items (status);

CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY,
  "orderId" integer NOT NULL,
  "branchId" integer NOT NULL,
  amount numeric(10,2) NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  "receivedBy" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_branch_created_idx ON payments ("branchId", "createdAt");
