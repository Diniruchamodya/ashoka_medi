'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray, ne, sql, type SQLWrapper } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  doctors,
  labPartners,
  orderTemplates,
  reportTemplateVisibility,
  reportTemplates,
  testCategories,
  tests,
} from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import { normalizeEmail, normalizeName, normalizePhone, validateOptionalEmail, validateOptionalPhone } from '@/lib/form-validation'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/report-template-defaults'

export type CrudState =
  | {
      error?: string
      nameError?: string
      emailError?: string
      phoneError?: string
      passwordError?: string
      branchError?: string
      offerDeactivate?: boolean
      success?: string
      nonce?: number
    }
  | undefined

export type ReportTemplateState =
  | {
      error?: string
      success?: string
      nonce?: number
    }
  | undefined

const text = (fd: FormData, key: string, max = 200) => {
  const v = String(fd.get(key) ?? '').trim().slice(0, max)
  return v || null
}
const idOf = (fd: FormData) => {
  const n = Number(fd.get('id'))
  return Number.isInteger(n) && n > 0 ? n : null
}
const ok = (success: string): CrudState => ({ success, nonce: Date.now() })
const invalidFields = (fields: Pick<NonNullable<CrudState>, 'nameError' | 'phoneError' | 'emailError'>): CrudState => ({
  error: 'Please correct the highlighted fields.',
  ...fields,
  nonce: Date.now(),
})

type ContactTable = typeof doctors | typeof labPartners
type ContactField = 'name' | 'phone' | 'email'

function normalizedPhoneColumn(column: SQLWrapper) {
  const compact = sql`regexp_replace(coalesce(${column}, ''), '[-[:space:]()]', '', 'g')`
  return sql`CASE WHEN ${compact} ~ '^[+]94[0-9]{9}$' THEN '0' || substring(${compact} from 4) ELSE ${compact} END`
}

async function hasContactDuplicate(
  table: ContactTable,
  field: ContactField,
  value: string,
  excludedId?: number,
) {
  const column = table[field]
  const normalizedColumn =
    field === 'name'
      ? sql`lower(btrim(regexp_replace(${column}, '[[:space:]]+', ' ', 'g')))`
      : field === 'phone'
        ? normalizedPhoneColumn(column)
        : sql`lower(btrim(${column}))`
  const normalizedValue =
    field === 'name' ? normalizeName(value) : field === 'phone' ? normalizePhone(value) : normalizeEmail(value)
  const sameValue = sql`${normalizedColumn} = ${normalizedValue}`
  const where = excludedId ? and(sameValue, ne(table.id, excludedId)) : sameValue
  const [duplicate] = await db.select({ id: table.id }).from(table).where(where).limit(1)
  return Boolean(duplicate)
}

function dbError(error: unknown): CrudState {
  const constraint = databaseConstraint(error)
  const contactDuplicate = duplicateErrorForConstraint(constraint)
  if (contactDuplicate) return contactDuplicate

  console.error('[catalog]', error)
  const msg = databaseCode(error)
  return { error: msg === '23505' ? 'That name or code already exists.' : 'Could not save. Please try again.' }
}

function databaseCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''
  if ('code' in error && typeof error.code === 'string') return error.code
  if ('cause' in error) return databaseCode(error.cause)
  return ''
}

function databaseConstraint(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''
  if ('constraint' in error && typeof error.constraint === 'string') return error.constraint
  if ('cause' in error) return databaseConstraint(error.cause)
  return ''
}

function duplicateErrorForConstraint(constraint: string): CrudState {
  const fieldByConstraint: Record<string, ContactField> = {
    doctors_name_normalized_unique: 'name',
    doctors_phone_normalized_unique: 'phone',
    doctors_email_normalized_unique: 'email',
    lab_partners_name_normalized_unique: 'name',
    lab_partners_phone_normalized_unique: 'phone',
    lab_partners_email_normalized_unique: 'email',
  }
  const field = fieldByConstraint[constraint]
  if (!field) return undefined
  const message =
    field === 'name'
      ? 'A record with this name already exists.'
      : field === 'phone'
        ? 'A record with this phone number already exists.'
        : 'A record with this email already exists.'
  return field === 'name'
    ? invalidFields({ nameError: message })
    : field === 'phone'
      ? invalidFields({ phoneError: message })
      : invalidFields({ emailError: message })
}

function duplicateContactState(field: ContactField, entity: string): CrudState {
  const message =
    field === 'name'
      ? `A ${entity} with this name already exists.`
      : field === 'phone'
        ? 'A record with this phone number already exists.'
        : 'A record with this email already exists.'
  return field === 'name'
    ? invalidFields({ nameError: message })
    : field === 'phone'
      ? invalidFields({ phoneError: message })
      : invalidFields({ emailError: message })
}

export async function saveCategory(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('categories')
  const id = idOf(fd)
  const name = text(fd, 'name')
  if (!name) return { error: 'Category name is required.' }
  const values = { name, description: text(fd, 'description', 500) }
  try {
    if (id) await db.update(testCategories).set(values).where(eq(testCategories.id, id))
    else await db.insert(testCategories).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/categories')
  return ok(id ? 'Category updated.' : 'Category added.')
}

export async function deleteCategory(fd: FormData) {
  await assertPermission('categories')
  const id = idOf(fd)
  if (!id) return
  await db.update(tests).set({ categoryId: null }).where(eq(tests.categoryId, id))
  await db.delete(testCategories).where(eq(testCategories.id, id))
  revalidatePath('/categories')
}

export async function saveTest(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('categories')
  const id = idOf(fd)
  const name = text(fd, 'name')
  const code = text(fd, 'code', 30)?.toUpperCase()
  const price = Number(fd.get('price'))
  const turnaround = Number(fd.get('turnaroundHours') || 24)
  const categoryId = Number(fd.get('categoryId')) || null
  const partnerId = Number(fd.get('partnerId')) || null
  if (!name || !code) return { error: 'Test name and code are required.' }
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { error: 'Enter a valid price.' }
  if (!Number.isInteger(turnaround) || turnaround < 1 || turnaround > 2000) {
    return { error: 'Turnaround must be between 1 and 2000 hours.' }
  }
  const values = {
    name,
    code,
    price: price.toFixed(2),
    turnaroundHours: turnaround,
    categoryId,
    partnerId,
    sampleType: text(fd, 'sampleType', 60),
    aliases: [...new Set(
      String(fd.get('aliases') ?? '')
        .split(/[,\n;]/)
        .map((alias) => alias.trim().slice(0, 100))
        .filter(Boolean),
    )],
    active: fd.get('active') !== 'off',
  }
  try {
    if (id) await db.update(tests).set(values).where(eq(tests.id, id))
    else await db.insert(tests).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/categories')
  revalidatePath('/templates')
  return ok(id ? 'Test updated.' : 'Test added.')
}

export async function deleteTest(fd: FormData) {
  await assertPermission('categories')
  const id = idOf(fd)
  if (!id) return
  // Tests referenced by past orders are deactivated instead of deleted to keep history intact.
  await db.update(tests).set({ active: false }).where(eq(tests.id, id))
  revalidatePath('/categories')
}

export async function saveDoctor(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('doctors')
  const rawId = fd.get('id')
  const id = idOf(fd)
  if (rawId !== null && rawId !== '' && !id) return { error: 'Invalid doctor.', nonce: Date.now() }
  const name = (text(fd, 'name') ?? '').replace(/\s+/g, ' ')
  if (!name) return invalidFields({ nameError: 'Doctor name is required.' })
  const phone = text(fd, 'phone', 30)
  const email = text(fd, 'email')

  let existing: { name: string; phone: string | null; email: string | null } | undefined
  let nameChanged = true
  let phoneChanged = true
  let emailChanged = true
  try {
    if (id) {
      const [row] = await db
        .select({ name: doctors.name, phone: doctors.phone, email: doctors.email })
        .from(doctors)
        .where(eq(doctors.id, id))
        .limit(1)
      existing = row
      if (!existing) return { error: 'Doctor not found.', nonce: Date.now() }
      nameChanged = normalizeName(existing.name) !== normalizeName(name)
      phoneChanged = normalizePhone(existing.phone ?? '') !== normalizePhone(phone ?? '')
      emailChanged = normalizeEmail(existing.email ?? '') !== normalizeEmail(email ?? '')
    }

    const phoneError = validateOptionalPhone(phone ?? '')
    const emailError = validateOptionalEmail(email ?? '')
    if (phoneError || emailError) return invalidFields({ phoneError, emailError })

    const [duplicateName, duplicatePhone, duplicateEmail] = await Promise.all([
      nameChanged ? hasContactDuplicate(doctors, 'name', name, id ?? undefined) : false,
      phone && phoneChanged ? hasContactDuplicate(doctors, 'phone', phone, id ?? undefined) : false,
      email && emailChanged ? hasContactDuplicate(doctors, 'email', email, id ?? undefined) : false,
    ])
    if (duplicateName || duplicatePhone || duplicateEmail) {
      return invalidFields({
        nameError: duplicateName ? 'A doctor with this name already exists.' : undefined,
        phoneError: duplicatePhone ? 'A record with this phone number already exists.' : undefined,
        emailError: duplicateEmail ? 'A record with this email already exists.' : undefined,
      })
    }
  } catch (error) {
    console.error('[catalog] doctor validation failed', error)
    return { error: 'Could not validate doctor details. Please try again.', nonce: Date.now() }
  }

  const values = {
    name,
    specialty: text(fd, 'specialty'),
    hospital: text(fd, 'hospital'),
    phone,
    email,
  }
  try {
    if (id) await db.update(doctors).set(values).where(eq(doctors.id, id))
    else await db.insert(doctors).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/doctors')
  return ok(id ? 'Doctor updated.' : 'Doctor added.')
}

export async function deleteDoctor(fd: FormData) {
  await assertPermission('doctors')
  const id = idOf(fd)
  if (id) await db.delete(doctors).where(eq(doctors.id, id))
  revalidatePath('/doctors')
}

export async function savePartner(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('partners')
  const rawId = fd.get('id')
  const id = idOf(fd)
  if (rawId !== null && rawId !== '' && !id) return { error: 'Invalid lab partner.', nonce: Date.now() }
  const name = (text(fd, 'name') ?? '').replace(/\s+/g, ' ')
  if (!name) return invalidFields({ nameError: 'Laboratory name is required.' })
  const phone = text(fd, 'phone', 30)
  const email = text(fd, 'email')

  let existing: { name: string; phone: string | null; email: string | null } | undefined
  let nameChanged = true
  let phoneChanged = true
  let emailChanged = true
  try {
    if (id) {
      const [row] = await db
        .select({ name: labPartners.name, phone: labPartners.phone, email: labPartners.email })
        .from(labPartners)
        .where(eq(labPartners.id, id))
        .limit(1)
      existing = row
      if (!existing) return { error: 'Lab partner not found.', nonce: Date.now() }
      nameChanged = normalizeName(existing.name) !== normalizeName(name)
      phoneChanged = normalizePhone(existing.phone ?? '') !== normalizePhone(phone ?? '')
      emailChanged = normalizeEmail(existing.email ?? '') !== normalizeEmail(email ?? '')
    }

    const phoneError = validateOptionalPhone(phone ?? '')
    const emailError = validateOptionalEmail(email ?? '')
    if (phoneError || emailError) return invalidFields({ phoneError, emailError })

    const [duplicateName, duplicatePhone, duplicateEmail] = await Promise.all([
      nameChanged ? hasContactDuplicate(labPartners, 'name', name, id ?? undefined) : false,
      phone && phoneChanged ? hasContactDuplicate(labPartners, 'phone', phone, id ?? undefined) : false,
      email && emailChanged ? hasContactDuplicate(labPartners, 'email', email, id ?? undefined) : false,
    ])
    if (duplicateName || duplicatePhone || duplicateEmail) {
      return invalidFields({
        nameError: duplicateName ? 'A lab partner with this name already exists.' : undefined,
        phoneError: duplicatePhone ? 'A record with this phone number already exists.' : undefined,
        emailError: duplicateEmail ? 'A record with this email already exists.' : undefined,
      })
    }
  } catch (error) {
    console.error('[catalog] lab partner validation failed', error)
    return { error: 'Could not validate lab partner details. Please try again.', nonce: Date.now() }
  }

  const values = {
    name,
    contactPerson: text(fd, 'contactPerson'),
    phone,
    email,
    address: text(fd, 'address', 500),
    active: fd.get('active') !== 'off',
  }
  try {
    if (id) await db.update(labPartners).set(values).where(eq(labPartners.id, id))
    else await db.insert(labPartners).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/partners')
  return ok(id ? 'Partner updated.' : 'Partner added.')
}

export async function deletePartner(fd: FormData) {
  await assertPermission('partners')
  const id = idOf(fd)
  if (!id) return
  await db.update(labPartners).set({ active: false }).where(eq(labPartners.id, id))
  revalidatePath('/partners')
}

export async function saveTemplate(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('templates')
  const id = idOf(fd)
  const name = text(fd, 'name')
  const requested = fd.getAll('testIds').map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (!name) return { error: 'Template name is required.' }
  if (requested.length === 0) return { error: 'Select at least one test.' }
  const valid = await db
    .select({ id: tests.id })
    .from(tests)
    .where(inArray(tests.id, [...new Set(requested)]))
  const values = { name, description: text(fd, 'description', 500), testIds: valid.map((t) => t.id) }
  try {
    if (id) await db.update(orderTemplates).set(values).where(eq(orderTemplates.id, id))
    else await db.insert(orderTemplates).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/templates')
  return ok(id ? 'Template updated.' : 'Template added.')
}

export async function deleteTemplate(fd: FormData) {
  await assertPermission('templates')
  const id = idOf(fd)
  if (id) await db.delete(orderTemplates).where(eq(orderTemplates.id, id))
  revalidatePath('/templates')
}

const REPORT_COLUMNS = ['parameter', 'result', 'unit', 'referenceInterval'] as const

export async function saveReportTemplate(
  _: ReportTemplateState,
  fd: FormData,
): Promise<ReportTemplateState> {
  await assertPermission('templates')
  const testId = Number(fd.get('testId'))
  if (!Number.isSafeInteger(testId) || testId <= 0) {
    return { error: 'Select a valid test.', nonce: Date.now() }
  }

  const names = fd.getAll('parameterName').map((value) => typeof value === 'string' ? value.trim() : '')
  const units = fd.getAll('parameterUnit').map((value) => typeof value === 'string' ? value.trim() : '')
  const intervals = fd.getAll('referenceInterval').map((value) => typeof value === 'string' ? value.trim() : '')
  if (names.length === 0 || names.length > 100 || names.length !== units.length || names.length !== intervals.length) {
    return { error: 'Add between 1 and 100 complete result parameter rows.', nonce: Date.now() }
  }
  if (names.some((name) => !name || name.length > 120) || units.some((unit) => unit.length > 60) || intervals.some((interval) => interval.length > 160)) {
    return { error: 'Each parameter needs a name. Check the maximum lengths for names, units, and reference intervals.', nonce: Date.now() }
  }
  const normalizedNames = names.map((name) => name.toLocaleLowerCase())
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    return { error: 'Parameter names must be unique within a template.', nonce: Date.now() }
  }

  const selectedColumns = new Set(fd.getAll('columns').filter(
    (value): value is string => typeof value === 'string' && (REPORT_COLUMNS as readonly string[]).includes(value),
  ))
  if (selectedColumns.size === 0) {
    return { error: 'Select at least one report column.', nonce: Date.now() }
  }
  const configuration = {
    parameters: names.map((name, index) => ({
      name,
      unit: units[index].slice(0, 60),
      referenceInterval: intervals[index].slice(0, 160),
    })),
    columns: REPORT_COLUMNS.filter((column) => selectedColumns.has(column)),
  }

  try {
    const [test] = await db.select({ id: tests.id }).from(tests).where(eq(tests.id, testId)).limit(1)
    if (!test) return { error: 'Test not found.', nonce: Date.now() }

    if (fd.get('createOnly') === 'true') {
      const created = await db
        .insert(reportTemplates)
        .values({ testId, configuration })
        .onConflictDoNothing()
        .returning({ id: reportTemplates.id })
      if (created.length === 0) {
        return { error: 'A report template already exists for this test.', nonce: Date.now() }
      }
    } else {
      await db
        .insert(reportTemplates)
        .values({ testId, configuration })
        .onConflictDoUpdate({
          target: reportTemplates.testId,
          set: { configuration, updatedAt: new Date() },
        })
    }
  } catch (error) {
    console.error('[report templates] save failed', error)
    return { error: 'Could not save the report template. Please try again.', nonce: Date.now() }
  }

  revalidatePath('/templates')
  return { success: 'Report template saved.', nonce: Date.now() }
}

export async function deleteReportTemplate(
  _: ReportTemplateState,
  fd: FormData,
): Promise<ReportTemplateState> {
  await assertPermission('templates')
  const testId = Number(fd.get('testId'))
  if (!Number.isSafeInteger(testId) || testId <= 0) {
    return { error: 'Select a valid test.', nonce: Date.now() }
  }

  try {
    const deleted = await db
      .delete(reportTemplates)
      .where(eq(reportTemplates.testId, testId))
      .returning({ id: reportTemplates.id })
    if (deleted.length === 0) return { error: 'Custom report template not found.', nonce: Date.now() }
  } catch (error) {
    console.error('[report templates] delete failed', error)
    return { error: 'Could not delete the custom report template. Please try again.', nonce: Date.now() }
  }

  revalidatePath('/templates')
  return { success: 'Custom report template deleted.', nonce: Date.now() }
}

export async function setSystemReportTemplateVisibility(
  _: ReportTemplateState,
  fd: FormData,
): Promise<ReportTemplateState> {
  await assertPermission('templates')
  const testId = Number(fd.get('testId'))
  const hiddenValue = fd.get('hidden')
  if (!Number.isSafeInteger(testId) || testId <= 0 || (hiddenValue !== 'true' && hiddenValue !== 'false')) {
    return { error: 'Invalid report template visibility request.', nonce: Date.now() }
  }

  try {
    const [test] = await db
      .select({ id: tests.id, code: tests.code })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)
    if (!test) return { error: 'Test not found.', nonce: Date.now() }
    if (!SYSTEM_REPORT_TEMPLATES[test.code]) {
      return { error: 'No approved system default exists for this test.', nonce: Date.now() }
    }

    await db
      .insert(reportTemplateVisibility)
      .values({ testId, hidden: hiddenValue === 'true', updatedAt: new Date() })
      .onConflictDoUpdate({
        target: reportTemplateVisibility.testId,
        set: { hidden: hiddenValue === 'true', updatedAt: new Date() },
      })
  } catch (error) {
    console.error('[report templates] visibility update failed', error)
    return { error: 'Could not update the system report template. Please try again.', nonce: Date.now() }
  }

  revalidatePath('/templates')
  return {
    success: hiddenValue === 'true' ? 'System default hidden.' : 'System default restored.',
    nonce: Date.now(),
  }
}
