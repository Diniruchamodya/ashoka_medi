import { asc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { branches, staffProfiles, user } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import { PageHeader, Panel } from '@/components/lab/page-parts'
import { StaffForm, StaffRowActions } from '@/components/staff/staff-form'

export const metadata: Metadata = { title: 'Staff' }

export default async function StaffPage() {
  const me = await requirePermission('staff')

  const [rows, branchRows] = await Promise.all([
    db
      .select({ profile: staffProfiles, name: user.name, email: user.email })
      .from(staffProfiles)
      .innerJoin(user, eq(user.id, staffProfiles.userId))
      .orderBy(asc(user.name)),
    db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(asc(branches.id)),
  ])
  const branchName = new Map(branchRows.map((b) => [b.id, b.name]))

  return (
    <>
      <PageHeader title="Staff" description="Manage accounts, roles and branch access." />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Panel title={`Team (${rows.length})`}>
          <ul className="flex flex-col divide-y divide-border">
            {rows.map(({ profile: p, name, email }) => (
              <li key={p.userId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {name}
                    {p.userId === me.user.id && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{email}</span>
                </div>
                <div className="flex flex-col items-end text-sm">
                  <span className="font-medium">{ROLE_LABELS[p.role as Role] ?? p.role}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.role === 'admin'
                      ? 'All branches'
                      : p.branchIds.map((id) => branchName.get(id)).filter(Boolean).join(', ')}
                  </span>
                </div>
                {!p.active && (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                    Disabled
                  </span>
                )}
                <StaffRowActions
                  staff={{
                    userId: p.userId,
                    name,
                    email,
                    phone: p.phone,
                    role: p.role,
                    branchIds: p.branchIds,
                    active: p.active,
                  }}
                  branches={branchRows}
                  isCurrentUser={p.userId === me.user.id}
                />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Add staff member" className="lg:sticky lg:top-36 lg:self-start">
          <StaffForm branches={branchRows} />
        </Panel>
      </div>
    </>
  )
}
