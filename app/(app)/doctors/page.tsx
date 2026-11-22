import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { doctors, orders } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { formatLKR } from '@/lib/format'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { DoctorForm } from '@/components/catalog/catalog-forms'
import { DeleteButton, EditToggle } from '@/components/lab/crud-form'
import { deleteDoctor } from '@/app/actions/catalog'

export const metadata: Metadata = { title: 'Doctors' }

export default async function DoctorsPage() {
  const staff = await requirePermission('doctors')
  const branchIds = staff.branches.map((b) => b.id)

  const rows = await db
    .select({
      doctor: doctors,
      referrals: sql<number>`count(${orders.id})::int`,
      revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(doctors)
    .leftJoin(
      orders,
      and(eq(orders.doctorId, doctors.id), inArray(orders.branchId, branchIds), ne(orders.status, 'cancelled')),
    )
    .groupBy(doctors.id)
    .orderBy(asc(doctors.name))

  return (
    <>
      <PageHeader title="Doctors" description="Referring doctors and the orders they send to the lab." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title={`Referring doctors (${rows.length})`}>
          {rows.length === 0 ? (
            <EmptyState>No doctors added yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map(({ doctor: d, referrals, revenue }) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[d.specialty, d.hospital, d.phone].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-sm">
                    <span className="font-medium tabular-nums">{referrals} referrals</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatLKR(revenue)}</span>
                  </div>
                  <EditToggle label={`Edit ${d.name}`}>
                    <DoctorForm doctor={d} />
                  </EditToggle>
                  <DeleteButton
                    action={deleteDoctor}
                    id={d.id}
                    label={`Delete ${d.name}`}
                    confirmText={`Delete ${d.name}? Past orders keep their records.`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Add doctor" className="lg:sticky lg:top-36 lg:self-start">
          <DoctorForm />
        </Panel>
      </div>
    </>
  )
}
