'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { getStaffContext } from '@/lib/staff'
import { can } from '@/lib/permissions'

export type PatientState =
  | {
      error?: string
      success?: string
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
  const gender = str('gender')
  const dob = str('dateOfBirth', 10)
  return {
    fullName: str('fullName'),
    gender: gender && ['male', 'female', 'other'].includes(gender) ? gender : null,
    dateOfBirth: dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null,
    phone: str('phone', 30),
    email: str('email'),
    nic: str('nic', 20),
    address: str('address', 500),
  }
}

export async function createPatient(_: PatientState, formData: FormData): Promise<PatientState> {
  const ctx = await assertPatientAccess()
  const data = readPatient(formData)
  if (!data.fullName) return { error: 'Patient name is required.' }

  const [created] = await db
    .insert(patients)
    .values({
      ...data,
      fullName: data.fullName,
      patientCode: `TMP-${crypto.randomUUID()}`,
      branchId: ctx.activeBranch!.id,
    })
    .returning({ id: patients.id })

  const patientCode = `P${String(created.id).padStart(6, '0')}`
  await db.update(patients).set({ patientCode }).where(eq(patients.id, created.id))

  revalidatePath('/patients')
  return {
    success: 'Patient registered.',
    patient: { id: created.id, patientCode, fullName: data.fullName, phone: data.phone },
  }
}

export async function updatePatient(_: PatientState, formData: FormData): Promise<PatientState> {
  await assertPatientAccess()
  const id = Number(formData.get('id'))
  const data = readPatient(formData)
  if (!data.fullName) return { error: 'Patient name is required.' }
  await db
    .update(patients)
    .set({ ...data, fullName: data.fullName })
    .where(eq(patients.id, id))
  revalidatePath(`/patients/${id}`)
  revalidatePath('/patients')
  return { success: 'Patient profile saved.' }
}
