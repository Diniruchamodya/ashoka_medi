'use server'

import { revalidatePath } from 'next/cache'
import { and, arrayContains, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { branches, orders, patients, payments, staffProfiles } from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import type { CrudState } from './catalog'

async function createBranchCode(name: string) {
  const base =
    name
      .normalize('NFKD')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10) || 'BRANCH'
  const existing = new Set((await db.select({ code: branches.code }).from(branches)).map((branch) => branch.code))
  let code = base
  let suffix = 2
  while (existing.has(code)) code = `${base}-${suffix++}`
  return code
}

function idFromForm(fd: FormData) {
  const raw = fd.get('id')
  if (raw === null || raw === '') return { id: null } as const
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return { error: 'Invalid branch.' } as const
  const id = Number(raw)
  return Number.isSafeInteger(id) ? { id } as const : { error: 'Invalid branch.' } as const
}

function databaseCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return ''
  if ('code' in error && typeof error.code === 'string') return error.code
  if ('cause' in error && typeof error.cause === 'object' && error.cause !== null && 'code' in error.cause) {
    return String(error.cause.code)
  }
  return ''
}

function revalidateBranchPages() {
  revalidatePath('/branches')
  revalidatePath('/staff')
  revalidatePath('/', 'layout')
}

export async function saveBranch(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('branches.manage')
  const parsedId = idFromForm(fd)
  if ('error' in parsedId) return { error: parsedId.error }

  const rawName = fd.get('name')
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name) return { error: 'Branch name is required.' }

  try {
    if (parsedId.id !== null) {
      const updated = await db
        .update(branches)
        .set({ name })
        .where(eq(branches.id, parsedId.id))
        .returning({ id: branches.id })
      if (updated.length === 0) return { error: 'Branch not found.' }
    } else {
      const code = await createBranchCode(name)
      await db.insert(branches).values({ name, code })
    }
  } catch (error) {
    console.error('[branches] save failed', error)
    return { error: 'Could not save branch. Please try again.' }
  }

  revalidateBranchPages()
  return { success: `Branch ${parsedId.id === null ? 'added' : 'updated'}.`, nonce: Date.now() }
}

export async function deleteBranch(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('branches.manage')
  const parsedId = idFromForm(fd)
  if ('error' in parsedId) return { error: parsedId.error }
  if (parsedId.id === null) return { error: 'Invalid branch.' }

  let branchName = 'Branch'
  try {
    const [branch] = await db
      .select({ name: branches.name })
      .from(branches)
      .where(eq(branches.id, parsedId.id))
      .limit(1)
    if (!branch) return { error: 'Branch not found.' }
    branchName = branch.name

    const [staff, patient, order, payment] = await Promise.all([
      db
        .select({ userId: staffProfiles.userId })
        .from(staffProfiles)
        .where(or(eq(staffProfiles.activeBranchId, parsedId.id), arrayContains(staffProfiles.branchIds, [parsedId.id])))
        .limit(1),
      db.select({ id: patients.id }).from(patients).where(eq(patients.branchId, parsedId.id)).limit(1),
      db.select({ id: orders.id }).from(orders).where(eq(orders.branchId, parsedId.id)).limit(1),
      db.select({ id: payments.id }).from(payments).where(eq(payments.branchId, parsedId.id)).limit(1),
    ])
    const linkedRecords = [
      staff.length > 0 && 'staff assignments',
      patient.length > 0 && 'patient records',
      order.length > 0 && 'orders',
      payment.length > 0 && 'payments',
    ].filter((label): label is string => Boolean(label))
    if (linkedRecords.length > 0) {
      return {
        error: `Cannot delete "${branchName}" because it is linked to ${linkedRecords.join(', ')}. Remove the references first.`,
      }
    }

    await db.delete(branches).where(eq(branches.id, parsedId.id))
  } catch (error) {
    if (databaseCode(error) === '23503') {
      return { error: `Cannot delete "${branchName}" because records still reference it.` }
    }
    console.error('[branches] delete failed', error)
    return { error: 'Could not delete branch. Please try again.' }
  }

  revalidateBranchPages()
  return { success: 'Branch deleted.', nonce: Date.now() }
}
