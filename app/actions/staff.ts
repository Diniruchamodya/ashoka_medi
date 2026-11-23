'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { branches, staffProfiles, session } from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import { isRole } from '@/lib/permissions'
import { validateSriLankanPhone } from '@/lib/phone-validation'
import type { CrudState } from './catalog'

async function readAssignment(fd: FormData) {
  const role = String(fd.get('role') ?? '')
  if (!isRole(role)) return { error: 'Choose a valid role.' } as const
  const valid = new Set((await db.select({ id: branches.id }).from(branches)).map((b) => b.id))
  const branchIds = [...new Set(fd.getAll('branchIds').map(Number))].filter((id) => valid.has(id))
  if (role !== 'admin' && branchIds.length === 0) return { error: 'Assign at least one branch.' } as const
  return { role, branchIds } as const
}

export async function createStaff(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('staff')
  const name = String(fd.get('name') ?? '').trim()
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const password = String(fd.get('password') ?? '')
  const phoneInput = String(fd.get('phone') ?? '')
  if (!name || !email) return { error: 'Name and email are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  const phoneError = validateSriLankanPhone(phoneInput)
  if (phoneError) return { error: phoneError, phoneError }
  const phone = phoneInput.trim()
  const assignment = await readAssignment(fd)
  if ('error' in assignment) return { error: assignment.error }

  try {
    // No nextCookies plugin is configured, so this creates the account without
    // replacing the administrator's own session.
    const result = await auth.api.signUpEmail({ body: { name, email, password } })
    await db.insert(staffProfiles).values({
      userId: result.user.id,
      role: assignment.role,
      branchIds: assignment.branchIds,
      activeBranchId: assignment.branchIds[0] ?? null,
      phone,
    })
  } catch (error) {
    console.error('[staff] create failed', error)
    return { error: 'Could not create this account. The email may already be in use.' }
  }
  revalidatePath('/staff')
  return { success: `${name} can now sign in.`, nonce: Date.now() }
}

export async function updateStaff(_: CrudState, fd: FormData): Promise<CrudState> {
  const me = await assertPermission('staff')
  const userId = String(fd.get('userId') ?? '')
  const active = fd.get('active') === 'on'
  const assignment = await readAssignment(fd)
  if ('error' in assignment) return { error: assignment.error }
  if (userId === me.user.id && (assignment.role !== 'admin' || !active)) {
    return { error: 'You cannot remove your own administrator access.' }
  }

  const [existing] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId))
  if (!existing) return { error: 'Staff member not found.' }
  const activeBranchId =
    existing.activeBranchId && assignment.branchIds.includes(existing.activeBranchId)
      ? existing.activeBranchId
      : (assignment.branchIds[0] ?? existing.activeBranchId)

  await db
    .update(staffProfiles)
    .set({ role: assignment.role, branchIds: assignment.branchIds, activeBranchId, active })
    .where(eq(staffProfiles.userId, userId))
  if (!active) await db.delete(session).where(eq(session.userId, userId))

  revalidatePath('/staff')
  return { success: 'Access updated.', nonce: Date.now() }
}
