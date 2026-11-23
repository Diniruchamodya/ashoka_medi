'use server'

import { revalidatePath } from 'next/cache'
import { and, arrayContains, asc, eq, isNotNull, ne, or, sql } from 'drizzle-orm'
import { verifyPassword } from 'better-auth/crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  account,
  branches,
  orderItems,
  orders,
  payments,
  session,
  staffProfiles,
  user,
  verification,
} from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import { isRole } from '@/lib/permissions'
import { validateSriLankanPhone } from '@/lib/phone-validation'
import type { CrudState } from './catalog'

async function readAssignment(fd: FormData) {
  const role = String(fd.get('role') ?? '')
  if (!isRole(role)) return { error: 'Choose a valid role.' } as const
  const rows = await db.select({ id: branches.id }).from(branches)
  const valid = new Set(rows.map((branch) => branch.id))
  const requested = fd.getAll('branchIds').map((value) => {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
    const id = Number(value)
    return Number.isSafeInteger(id) ? id : null
  })
  if (requested.some((id) => id === null || !valid.has(id))) {
    const error = 'Select valid branches.'
    return { error, branchError: error } as const
  }
  const branchIds = [...new Set(requested.filter((id): id is number => id !== null))]
  if (role === 'admin') return { role, branchIds: rows.map((branch) => branch.id) } as const
  if (branchIds.length === 0) {
    const error = 'Assign at least one branch.'
    return { error, branchError: 'Select at least one branch.' } as const
  }
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
  if ('error' in assignment) return assignment

  const credentials = await db
    .select({ hash: account.password })
    .from(account)
    .innerJoin(staffProfiles, eq(staffProfiles.userId, account.userId))
    .where(and(eq(account.providerId, 'credential'), isNotNull(account.password)))
  for (const { hash } of credentials) {
    if (hash && (await verifyPassword({ hash, password }))) {
      const error = 'Choose a different temporary password.'
      return { error, passwordError: error }
    }
  }

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
  const rawUserId = fd.get('userId')
  const userId = typeof rawUserId === 'string' ? rawUserId : ''
  if (!userId) return { error: 'Staff member not found.' }

  const rawName = fd.get('name')
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name) return { error: 'Full name is required.', nameError: 'Enter a full name.' }

  const rawEmail = fd.get('email')
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (!email) return { error: 'Email is required.', emailError: 'Enter an email address.' }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.', emailError: 'Enter a valid email address.' }
  }

  const phoneInput = String(fd.get('phone') ?? '')
  const phoneError = validateSriLankanPhone(phoneInput)
  if (phoneError) return { error: phoneError, phoneError }
  const phone = phoneInput.trim()

  const active = fd.get('active') === 'on'
  const assignment = await readAssignment(fd)
  if ('error' in assignment) return assignment

  try {
    const result = await db.transaction(async (tx) => {
      const activeAdmins = await tx
        .select({ userId: staffProfiles.userId })
        .from(staffProfiles)
        .where(and(eq(staffProfiles.role, 'admin'), eq(staffProfiles.active, true)))
        .orderBy(asc(staffProfiles.userId))
        .for('update')
      const [existing] = await tx
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.userId, userId))
        .for('update')
      if (!existing) return { error: 'Staff member not found.' }

      const [existingUser] = await tx
        .select({ email: user.email, emailVerified: user.emailVerified })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
      if (!existingUser) return { error: 'Staff member not found.' }

      if (userId === me.user.id && !active) {
        return { error: 'You cannot deactivate your own account.' }
      }
      if (
        existing.role === 'admin' &&
        existing.active &&
        (assignment.role !== 'admin' || !active) &&
        activeAdmins.length <= 1
      ) {
        return { error: 'At least one active administrator must remain.' }
      }

      const [duplicate] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(sql`lower(${user.email}) = ${email}`, ne(user.id, userId)))
        .limit(1)
      if (duplicate) {
        return { error: 'Email is already in use.', emailError: 'This email is already in use.' }
      }

      const activeBranchId =
        existing.activeBranchId && assignment.branchIds.includes(existing.activeBranchId)
          ? existing.activeBranchId
          : (assignment.branchIds[0] ?? null)
      await tx
        .update(user)
        .set({
          name,
          email,
          emailVerified: email === existingUser.email ? existingUser.emailVerified : false,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId))
      await tx
        .update(staffProfiles)
        .set({ role: assignment.role, branchIds: assignment.branchIds, activeBranchId, active })
        .where(eq(staffProfiles.userId, userId))
      if (!active) await tx.delete(session).where(eq(session.userId, userId))
      return undefined
    })
    if (result) return result
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      return { error: 'Email is already in use.', emailError: 'This email is already in use.' }
    }
    console.error('[staff] update failed', error)
    return { error: 'Could not update this staff member. Please try again.' }
  }
  revalidatePath('/staff')
  revalidatePath('/', 'layout')
  return { success: 'Staff member updated.', nonce: Date.now() }
}

function databaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return ''
  if ('code' in error && typeof error.code === 'string') return error.code
  if ('cause' in error && typeof error.cause === 'object' && error.cause !== null && 'code' in error.cause) {
    return String(error.cause.code)
  }
  return ''
}

export async function deleteStaff(_: CrudState, fd: FormData): Promise<CrudState> {
  const me = await assertPermission('staff')
  const rawUserId = fd.get('userId')
  const userId = typeof rawUserId === 'string' ? rawUserId : ''
  if (!userId) return { error: 'Staff member not found.' }
  if (userId === me.user.id) return { error: 'You cannot delete your own account.' }

  let targetIsActive = false
  try {
    const result = await db.transaction(async (tx) => {
      const activeAdmins = await tx
        .select({ userId: staffProfiles.userId })
        .from(staffProfiles)
        .where(and(eq(staffProfiles.role, 'admin'), eq(staffProfiles.active, true)))
        .orderBy(asc(staffProfiles.userId))
        .for('update')
      const [profile] = await tx
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.userId, userId))
        .for('update')
      if (!profile) return { error: 'Staff member not found.' }
      targetIsActive = profile.active
      if (profile.role === 'admin' && profile.active && activeAdmins.length <= 1) {
        return { error: 'At least one active administrator must remain.' }
      }

      const [staffUser] = await tx
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
      if (!staffUser) return { error: 'Staff member not found.' }

      const [createdOrder] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.createdBy, userId))
        .limit(1)
      const [receivedPayment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.receivedBy, userId))
        .limit(1)
      const [updatedLabItem] = await tx
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(eq(orderItems.updatedBy, userId))
        .limit(1)
      const history = [
        createdOrder && 'orders',
        receivedPayment && 'payments',
        updatedLabItem && 'lab records',
      ].filter((record): record is string => Boolean(record))
      if (history.length > 0) {
        return {
          error: profile.active
            ? `Cannot delete this account because it is linked to ${history.join(', ')}. Deactivate it instead.`
            : `Cannot delete this account because it is linked to ${history.join(', ')}. It is already inactive.`,
          offerDeactivate: profile.active,
        }
      }

      await tx.delete(staffProfiles).where(eq(staffProfiles.userId, userId))
      await tx.delete(session).where(eq(session.userId, userId))
      await tx.delete(account).where(eq(account.userId, userId))
      await tx.delete(verification).where(eq(verification.identifier, staffUser.email))
      await tx.delete(user).where(eq(user.id, userId))
      return undefined
    })
    if (result) return result
  } catch (error) {
    if (databaseErrorCode(error) === '23503') {
      return {
        error: targetIsActive
          ? 'Other records still reference this account. Deactivate it instead.'
          : 'Other records still reference this account. The account is already inactive.',
        offerDeactivate: targetIsActive,
      }
    }
    console.error('[staff] delete failed', error)
    return { error: 'Could not delete this staff member. Please try again.' }
  }

  revalidatePath('/staff')
  revalidatePath('/', 'layout')
  return { success: 'Staff member deleted.', nonce: Date.now() }
}

export async function deactivateStaff(_: CrudState, fd: FormData): Promise<CrudState> {
  const me = await assertPermission('staff')
  const rawUserId = fd.get('userId')
  const userId = typeof rawUserId === 'string' ? rawUserId : ''
  if (!userId) return { error: 'Staff member not found.' }
  if (userId === me.user.id) return { error: 'You cannot deactivate your own account.' }

  try {
    const result = await db.transaction(async (tx) => {
      const activeAdmins = await tx
        .select({ userId: staffProfiles.userId })
        .from(staffProfiles)
        .where(and(eq(staffProfiles.role, 'admin'), eq(staffProfiles.active, true)))
        .orderBy(asc(staffProfiles.userId))
        .for('update')
      const [profile] = await tx
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.userId, userId))
        .for('update')
      if (!profile) return { error: 'Staff member not found.' }
      if (!profile.active) return undefined
      if (profile.role === 'admin' && activeAdmins.length <= 1) {
        return { error: 'At least one active administrator must remain.' }
      }

      await tx.update(staffProfiles).set({ active: false }).where(eq(staffProfiles.userId, userId))
      await tx.delete(session).where(eq(session.userId, userId))
      return undefined
    })
    if (result) return result
  } catch (error) {
    console.error('[staff] deactivation failed', error)
    return { error: 'Could not deactivate this staff member. Please try again.' }
  }

  revalidatePath('/staff')
  revalidatePath('/', 'layout')
  return { success: 'Staff member deactivated.', nonce: Date.now() }
}
