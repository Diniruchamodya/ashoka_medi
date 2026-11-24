import { sql, type SQLWrapper } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

function normalizedName(column: SQLWrapper) {
  return sql`lower(btrim(regexp_replace(${column}, '[[:space:]]+', ' ', 'g')))`
}

function normalizedPhone(column: SQLWrapper) {
  const compact = sql`regexp_replace(coalesce(${column}, ''), '[-[:space:]()]', '', 'g')`
  return sql`CASE WHEN ${compact} ~ '^[+]94[0-9]{9}$' THEN '0' || substring(${compact} from 4) ELSE ${compact} END`
}

function normalizedEmail(column: SQLWrapper) {
  return sql`lower(btrim(${column}))`
}

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  address: text('address'),
  phone: text('phone'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const staffProfiles = pgTable('staff_profiles', {
  userId: text('userId').primaryKey(),
  role: text('role').notNull().default('receptionist'),
  branchIds: integer('branchIds').array().notNull().default([]),
  activeBranchId: integer('activeBranchId'),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const testCategories = pgTable('test_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const labPartners = pgTable('lab_partners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contactPerson: text('contactPerson'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('lab_partners_name_normalized_unique').on(normalizedName(table.name)),
  uniqueIndex('lab_partners_phone_normalized_unique')
    .on(normalizedPhone(table.phone))
    .where(sql`nullif(btrim(${table.phone}), '') IS NOT NULL`),
  uniqueIndex('lab_partners_email_normalized_unique')
    .on(normalizedEmail(table.email))
    .where(sql`nullif(btrim(${table.email}), '') IS NOT NULL`),
])

export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  categoryId: integer('categoryId'),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0'),
  sampleType: text('sampleType'),
  aliases: text('aliases').array().notNull().default([]),
  turnaroundHours: integer('turnaroundHours').notNull().default(24),
  partnerId: integer('partnerId'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const doctors = pgTable('doctors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  specialty: text('specialty'),
  hospital: text('hospital'),
  phone: text('phone'),
  email: text('email'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('doctors_name_normalized_unique').on(normalizedName(table.name)),
  uniqueIndex('doctors_phone_normalized_unique')
    .on(normalizedPhone(table.phone))
    .where(sql`nullif(btrim(${table.phone}), '') IS NOT NULL`),
  uniqueIndex('doctors_email_normalized_unique')
    .on(normalizedEmail(table.email))
    .where(sql`nullif(btrim(${table.email}), '') IS NOT NULL`),
])

export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  patientCode: text('patientCode').notNull().unique(),
  fullName: text('fullName').notNull(),
  gender: text('gender'),
  dateOfBirth: date('dateOfBirth'),
  phone: text('phone'),
  email: text('email'),
  nic: text('nic'),
  address: text('address'),
  branchId: integer('branchId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('patients_full_name_normalized_unique').on(normalizedName(table.fullName)),
  uniqueIndex('patients_phone_normalized_unique')
    .on(normalizedPhone(table.phone))
    .where(sql`nullif(btrim(${table.phone}), '') IS NOT NULL`),
  uniqueIndex('patients_email_normalized_unique')
    .on(normalizedEmail(table.email))
    .where(sql`nullif(btrim(${table.email}), '') IS NOT NULL`),
])

export const orderTemplates = pgTable('order_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  testIds: integer('testIds').array().notNull().default([]),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export type ReportTemplateParameter = {
  name: string
  unit: string
  referenceInterval: string
}

export type ReportTemplateConfiguration = {
  parameters: ReportTemplateParameter[]
  columns: string[]
}

export const reportTemplates = pgTable('report_templates', {
  id: serial('id').primaryKey(),
  testId: integer('testId').notNull().unique().references(() => tests.id, { onDelete: 'cascade' }),
  configuration: jsonb('configuration').$type<ReportTemplateConfiguration>().notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const reportTemplateVisibility = pgTable('report_template_visibility', {
  testId: integer('testId').primaryKey().references(() => tests.id, { onDelete: 'cascade' }),
  hidden: boolean('hidden').notNull().default(false),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const signInRateLimits = pgTable('sign_in_rate_limits', {
  scope: text('scope').notNull(),
  keyHash: text('keyHash').notNull(),
  failureCount: integer('failureCount').notNull(),
  windowStartedAt: timestamp('windowStartedAt', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('lockedUntil', { withTimezone: true }),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.scope, table.keyHash] }),
  index('sign_in_rate_limits_updated_idx').on(table.updatedAt),
])

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('orderNumber').notNull().unique(),
  branchId: integer('branchId').notNull(),
  patientId: integer('patientId').notNull(),
  doctorId: integer('doctorId'),
  status: text('status').notNull().default('pending'),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
  paidAmount: numeric('paidAmount', { precision: 10, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdBy: text('createdBy'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('orderId').notNull(),
  testId: integer('testId').notNull(),
  testName: text('testName').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0'),
  status: text('status').notNull().default('pending'),
  partnerId: integer('partnerId'),
  result: text('result'),
  updatedBy: text('updatedBy'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
})

export type OrderedTestResult = {
  columns: string[]
  parameters: {
    name: string
    value: string
    unit: string
    referenceInterval: string
    flag?: string
  }[]
}

export const orderItemResults = pgTable('order_item_results', {
  orderItemId: integer('orderItemId').primaryKey().references(() => orderItems.id, { onDelete: 'cascade' }),
  resultData: jsonb('resultData').$type<OrderedTestResult>().notNull(),
  updatedBy: text('updatedBy'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const orderItemSmsNotifications = pgTable('order_item_sms_notifications', {
  orderItemId: integer('orderItemId').primaryKey().references(() => orderItems.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  submittedBy: text('submittedBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  submittedAt: timestamp('submittedAt'),
})

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('orderId').notNull(),
  branchId: integer('branchId').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  method: text('method').notNull().default('cash'),
  receivedBy: text('receivedBy'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
