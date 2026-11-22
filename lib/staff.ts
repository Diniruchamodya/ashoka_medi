import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { asc, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { branches, staffProfiles } from '@/lib/db/schema'
import { can, type Permission } from '@/lib/permissions'

export type StaffContext = Awaited<ReturnType<typeof loadStaffContext>>

async function loadStaffContext() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, session.user.id))
  if (!profile || !profile.active) return { user: session.user, profile: null } as const

  const accessibleBranches =
    profile.role === 'admin'
      ? await db.select().from(branches).orderBy(asc(branches.id))
      : profile.branchIds.length
        ? await db
            .select()
            .from(branches)
            .where(inArray(branches.id, profile.branchIds))
            .orderBy(asc(branches.id))
        : []

  const activeBranch =
    accessibleBranches.find((b) => b.id === profile.activeBranchId) ??
    accessibleBranches[0] ??
    null

  return {
    user: session.user,
    profile,
    branches: accessibleBranches,
    activeBranch,
  } as const
}

export const getStaffContext = cache(loadStaffContext)

export async function requireStaff() {
  const ctx = await getStaffContext()
  if (!ctx) redirect('/sign-in')
  if (!ctx.profile) redirect('/no-access')
  if (!ctx.activeBranch) redirect('/no-access')
  return {
    user: ctx.user,
    profile: ctx.profile,
    branches: ctx.branches,
    activeBranch: ctx.activeBranch,
  }
}

export async function requirePermission(permission: Permission) {
  const staff = await requireStaff()
  if (!can(staff.profile.role, permission)) redirect('/?denied=1')
  return staff
}

export async function assertPermission(permission: Permission) {
  const ctx = await getStaffContext()
  if (!ctx?.profile || !ctx.activeBranch) throw new Error('Unauthorized')
  if (!can(ctx.profile.role, permission)) throw new Error('Forbidden')
  return {
    user: ctx.user,
    profile: ctx.profile,
    branches: ctx.branches,
    activeBranch: ctx.activeBranch,
  }
}
