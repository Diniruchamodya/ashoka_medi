'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orderItems, orders, patients, payments } from '@/lib/db/schema'
import { getStaffContext } from '@/lib/staff'
import { can } from '@/lib/permissions'
import { normalizeEmail, normalizeName, normalizePhone, validateOptionalEmail, validateOptionalPhone } from '@/lib/form-validation'

export type PatientState =
  | {
      error?: string
      success?: string
      fieldErrors?: { fullName?: string; phone?: string; email?: string }
      nonce?: number
      duplicateQuery?: string
      patient?: { id: number; patientCode: string; fullName: string; phone: string | null }
    }
  | undefined

async function assertPatientAccess() {
  const ctx = await getStaffContext()
  if (!ctx?.profile || !ctx.activeBranch) throw new Error('Unauthorized')
  if (!can(ctx.profile.role, 'patients') && !can(ctx.profile.role, 'orders.create')) {
    throw new Error('Forbidden')
  }
  return ctx
}

function readPatient(formData: FormData) {
  const str = (key: string, max = 200) => {
    const v = String(formData.get(key) ?? '').trim().slice(0, max)
    return v || null
  }
  const rawName = formData.get('fullName')
  const fullName =
    typeof rawName === 'string'
      ? rawName.replace(/\s+/g, ' ').trim().slice(0, 200) || null
      : null
  const gender = str('gender')
  return {
    fullName,
    gender: gender && ['male', 'female', 'other'].includes(gender) ? gender : null,
    phone: str('phone', 30),
    email: str('email'),
    address: str('address', 500),
  }
}

function normalizedPhoneColumn() {
  const compact = sql`regexp_replace(coalesce(${patients.phone}, ''), '[-[:space:]()]', '', 'g')`
  return sql`CASE WHEN ${compact} ~ '^[+]94[0-9]{9}$' THEN '0' || substring(${compact} from 4) ELSE ${compact} END`
}

async function patientContactExists(
  field: 'fullName' | 'phone' | 'email',
  value: string,
  excludedId?: number,
) {
  const column = patients[field]
  const normalizedColumn =
    field === 'fullName'
      ? sql`lower(btrim(regexp_replace(${column}, '[[:space:]]+', ' ', 'g')))`
      : field === 'phone'
        ? normalizedPhoneColumn()
        : sql`lower(btrim(${column}))`
  const normalizedValue =
    field === 'fullName' ? normalizeName(value) : field === 'phone' ? normalizePhone(value) : normalizeEmail(value)
  const sameValue = sql`${normalizedColumn} = ${normalizedValue}`
  const where = excludedId
    ? and(sameValue, ne(patients.id, excludedId))
    : sameValue
  const [existing] = await db.select({ id: patients.id }).from(patients).where(where).limit(1)
  return Boolean(existing)
}

function duplicatePatientState(field: 'fullName' | 'phone' | 'email', duplicateQuery: string): PatientState {
  const message =
    field === 'fullName'
      ? 'A patient with this name is already registered.'
      : field === 'phone'
        ? 'A patient with this phone number is already registered.'
        : 'A patient with this email is already registered.'
  return {
    error: message,
    fieldErrors: { [field]: message },
    duplicateQuery,
    nonce: Date.now(),
  }
}

function readPatientId(formData: FormData) {
  const raw = formData.get('id')
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

function databaseCode(error: unknown) {
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

function patientDuplicateField(error: unknown): 'fullName' | 'phone' | 'email' | undefined {
  const constraints: Record<string, 'fullName' | 'phone' | 'email'> = {
    patients_full_name_normalized_unique: 'fullName',
    patients_phone_normalized_unique: 'phone',
    patients_email_normalized_unique: 'email',
  }
  return constraints[databaseConstraint(error)]
}

export async function createPatient(_: PatientState, formData: FormData): Promise<PatientState> {
  const ctx = await assertPatientAccess()
  const data = readPatient(formData)
  if (!data.fullName) {
    return {
      error: 'Check the highlighted field.',
      fieldErrors: { fullName: 'Patient name is required.' },
      nonce: Date.now(),
    }
  }

  const phoneError = validateOptionalPhone(data.phone ?? '')
  const emailError = validateOptionalEmail(data.email ?? '')
  if (phoneError || emailError) {
    return {
      error: 'Check the highlighted fields.',
      fieldErrors: { phone: phoneError, email: emailError },
      nonce: Date.now(),
    }
  }

  try {
    const [duplicateName, duplicatePhone, duplicateEmail] = await Promise.all([
      patientContactExists('fullName', data.fullName),
      data.phone ? patientContactExists('phone', data.phone) : false,
      data.email ? patientContactExists('email', data.email) : false,
    ])
    if (duplicateName) return duplicatePatientState('fullName', data.fullName)
    if (duplicatePhone) return duplicatePatientState('phone', data.phone ?? '')
    if (duplicateEmail) return duplicatePatientState('email', data.email ?? '')
  } catch (error) {
    console.error('[patients] duplicate-contact check failed', error)
    return { error: 'Could not validate patient details. Please try again.', nonce: Date.now() }
  }

  let created: { id: number }
  let patientCode: string
  try {
    const [row] = await db
      .insert(patients)
      .values({
        ...data,
        fullName: data.fullName,
        patientCode: `TMP-${crypto.randomUUID()}`,
        branchId: ctx.activeBranch!.id,
      })
      .returning({ id: patients.id })
    created = row

    patientCode = `P${String(created.id).padStart(6, '0')}`
    await db.update(patients).set({ patientCode }).where(eq(patients.id, created.id))
  } catch (error) {
    const duplicateField = patientDuplicateField(error)
    if (duplicateField) {
      const value =
        duplicateField === 'fullName' ? data.fullName : duplicateField === 'phone' ? data.phone : data.email
      return duplicatePatientState(duplicateField, value ?? '')
    }
    console.error('[patients] create failed', error)
    return { error: 'Could not register patient. Please try again.', nonce: Date.now() }
  }

  revalidatePath('/patients')
  return {
    success: 'Patient registered.',
    nonce: Date.now(),
    patient: { id: created.id, patientCode, fullName: data.fullName, phone: data.phone },
  }
}

export async function updatePatient(_: PatientState, formData: FormData): Promise<PatientState> {
  await assertPatientAccess()
  const id = readPatientId(formData)
  if (!id) return { error: 'Invalid patient.' }
  const data = readPatient(formData)
  if (!data.fullName) {
    return {
      error: 'Check the highlighted field.',
      fieldErrors: { fullName: 'Patient name is required.' },
    }
  }
  try {
    const [existing] = await db
      .select({ fullName: patients.fullName, phone: patients.phone, email: patients.email })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1)
    if (!existing) return { error: 'Patient not found.', nonce: Date.now() }

    const nameChanged = normalizeName(existing.fullName) !== normalizeName(data.fullName)
    const phoneChanged = normalizePhone(existing.phone ?? '') !== normalizePhone(data.phone ?? '')
    const emailChanged = normalizeEmail(existing.email ?? '') !== normalizeEmail(data.email ?? '')
    const phoneError = validateOptionalPhone(data.phone ?? '')
    const emailError = validateOptionalEmail(data.email ?? '')
    if (phoneError || emailError) {
      return {
        error: 'Check the highlighted fields.',
        fieldErrors: { phone: phoneError, email: emailError },
        nonce: Date.now(),
      }
    }

    const [duplicateName, duplicatePhone, duplicateEmail] = await Promise.all([
      nameChanged ? patientContactExists('fullName', data.fullName, id) : false,
      data.phone && phoneChanged ? patientContactExists('phone', data.phone, id) : false,
      data.email && emailChanged ? patientContactExists('email', data.email, id) : false,
    ])
    if (duplicateName) return duplicatePatientState('fullName', data.fullName)
    if (duplicatePhone) return duplicatePatientState('phone', data.phone ?? '')
    if (duplicateEmail) return duplicatePatientState('email', data.email ?? '')

    const updated = await db
      .update(patients)
      .set({ ...data, fullName: data.fullName })
      .where(eq(patients.id, id))
      .returning({ id: patients.id })
    if (updated.length === 0) return { error: 'Patient not found.' }
  } catch (error) {
    const duplicateField = patientDuplicateField(error)
    if (duplicateField) {
      const value =
        duplicateField === 'fullName' ? data.fullName : duplicateField === 'phone' ? data.phone : data.email
      return duplicatePatientState(duplicateField, value ?? '')
    }
    console.error('[patients] update failed', error)
    return { error: 'Could not save patient details. Please try again.' }
  }

  revalidatePath(`/patients/${id}`)
  revalidatePath('/patients')
  return { success: 'Patient profile saved.', nonce: Date.now() }
}

export async function deletePatient(_: PatientState, formData: FormData): Promise<PatientState> {
  await assertPatientAccess()
  const id = readPatientId(formData)
  if (!id) return { error: 'Invalid patient.' }

  let patient: { fullName: string } | undefined
  let linkedRecords: string[]
  try {
    const [row] = await db
      .select({ fullName: patients.fullName })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1)
    patient = row
    if (!patient) return { error: 'Patient not found.' }

    const [linkedOrder, linkedPayment, linkedLabRecord] = await Promise.all([
      db.select({ id: orders.id }).from(orders).where(eq(orders.patientId, id)).limit(1),
      db
        .select({ id: payments.id })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(eq(orders.patientId, id))
        .limit(1),
      db
        .select({ id: orderItems.id })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orders.patientId, id))
        .limit(1),
    ])
    linkedRecords = [
      linkedOrder.length > 0 && 'orders',
      linkedPayment.length > 0 && 'payments',
      linkedLabRecord.length > 0 && 'lab records or reports',
    ].filter((record): record is string => Boolean(record))
  } catch (error) {
    console.error('[patients] delete dependency check failed', error)
    return { error: 'Could not verify linked records. The patient was not deleted.' }
  }

  if (!patient) return { error: 'Patient not found.' }
  if (linkedRecords.length > 0) {
    return {
      error: `Cannot delete "${patient.fullName}" because it has linked ${linkedRecords.join(', ')}. The patient record and linked data were not changed.`,
    }
  }

  try {
    const deleted = await db
      .delete(patients)
      .where(eq(patients.id, id))
      .returning({ id: patients.id })
    if (deleted.length === 0) return { error: 'Patient not found.' }
  } catch (error) {
    if (databaseCode(error) === '23503') {
      return {
        error: `Cannot delete "${patient.fullName}" because retained records still reference this patient. The linked data was not changed.`,
      }
    }
    console.error('[patients] delete failed', error)
    return { error: 'Could not delete patient. Please try again.' }
  }

  revalidatePath('/patients')
  revalidatePath(`/patients/${id}`)
  return { success: 'Patient deleted.', nonce: Date.now() }
}
