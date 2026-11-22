'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { branches, staffProfiles } from '@/lib/db/schema'
import { getStaffContext } from '@/lib/staff'
import { can } from '@/lib/permissions'

export type FormState = { error?: string; success?: string } | undefined

export async function hasAnyStaff() {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(staffProfiles)
  return (row?.count ?? 0) > 0
}

export async function createInitialAdmin(_: FormState, formData: FormData): Promise<FormState> {
  if (await hasAnyStaff()) return { error: 'Setup has already been completed. Please sign in.' }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!name || !email || password.length < 8) {
    return { error: 'Enter a name, a valid email, and a password of at least 8 characters.' }
  }

  try {
    const result = await auth.api.signUpEmail({ body: { name, email, password } })
    const allBranches = await db.select({ id: branches.id }).from(branches)
    await db.insert(staffProfiles).values({
      userId: result.user.id,
      role: 'admin',
      branchIds: allBranches.map((b) => b.id),
      activeBranchId: allBranches[0]?.id ?? null,
    })
  } catch (error) {
    console.error('[setup] failed to create admin', error)
    return { error: 'Could not create the administrator account. Try a different email.' }
  }

  redirect('/sign-in?setup=done')
}

export async function setActiveBranch(formData: FormData) {
  const ctx = await getStaffContext()
  if (!ctx?.profile) throw new Error('Unauthorized')
  if (!can(ctx.profile.role, 'branches.switch')) throw new Error('Forbidden')

  const branchId = Number(formData.get('branchId'))
  if (!ctx.branches.some((b) => b.id === branchId)) throw new Error('Forbidden')

  await db
    .update(staffProfiles)
    .set({ activeBranchId: branchId })
    .where(eq(staffProfiles.userId, ctx.user.id))
  revalidatePath('/', 'layout')
}
