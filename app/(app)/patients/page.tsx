import Link from 'next/link'
import { count, desc, ilike, or, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { orders, patients } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { ageFrom, formatDate } from '@/lib/format'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { PatientQuickForm } from '@/components/orders/patient-quick-form'
import { PatientRowActions } from '@/components/patients/patient-row-actions'
import { LiveSearch, LiveSearchInput, LiveSearchResults } from '@/components/search/live-search'

export const metadata: Metadata = { title: 'Patients' }

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission('patients')
  const { q = '' } = await searchParams
  const like = `%${q.trim()}%`
  const phoneQuery = q.trim().replace(/[\s()-]/g, '')
  const searchTerms = [
    ilike(patients.fullName, like),
    ilike(patients.nic, like),
    ilike(patients.patientCode, like),
  ]
  if (phoneQuery) {
    searchTerms.push(
      sql`regexp_replace(coalesce(${patients.phone}, ''), '[-[:space:]()]', '', 'g') ILIKE ${`%${phoneQuery}%`}`,
    )
  }
  const where = q.trim()
    ? or(...searchTerms)
    : undefined

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: patients.id,
        patientCode: patients.patientCode,
        fullName: patients.fullName,
        gender: patients.gender,
        dateOfBirth: patients.dateOfBirth,
        phone: patients.phone,
        email: patients.email,
        nic: patients.nic,
        address: patients.address,
        createdAt: patients.createdAt,
        orderCount: sql<number>`(select count(*)::int from ${orders} where ${orders.patientId} = ${patients.id})`,
      })
      .from(patients)
      .where(where)
      .orderBy(desc(patients.createdAt))
      .limit(100),
    db.select({ total: count() }).from(patients).where(where),
  ])
  const total = countRows[0]?.total ?? 0

  return (
    <>
      <PageHeader
        title="Patients"
        description="Patient records shared across all branches."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <LiveSearch name="q" initialValue={q}>
            <div className="rounded-xl border border-border bg-card p-3">
              <LiveSearchInput
                placeholder="Search name, phone, NIC or patient ID"
                ariaLabel="Search patients"
              />
            </div>
            <LiveSearchResults query={q}>
              <p className="text-sm text-muted-foreground">{total} matching patients.</p>
              {rows.length === 0 ? (
                <EmptyState>No patients found.</EmptyState>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Patient</th>
                        <th className="px-4 py-3 font-medium">Age / Gender</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium">Orders</th>
                        <th className="hidden px-4 py-3 font-medium md:table-cell">Registered</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((p) => {
                        const age = ageFrom(p.dateOfBirth)
                        return (
                          <tr key={p.id} className="hover:bg-muted/40">
                            <td className="px-4 py-3">
                              <Link href={`/patients/${p.id}`} className="font-medium text-primary hover:underline">
                                {p.fullName}
                              </Link>
                              <div className="text-xs text-muted-foreground">{p.patientCode}</div>
                            </td>
                            <td className="px-4 py-3 capitalize">
                              {age !== null ? `${age} yrs` : '—'} / {p.gender ?? '—'}
                            </td>
                            <td className="px-4 py-3">{p.phone ?? '—'}</td>
                            <td className="px-4 py-3 tabular-nums">{p.orderCount}</td>
                            <td className="hidden px-4 py-3 md:table-cell">{formatDate(p.createdAt)}</td>
                            <td className="px-4 py-3">
                              <PatientRowActions
                                patient={{
                                  id: p.id,
                                  fullName: p.fullName,
                                  gender: p.gender,
                                  phone: p.phone,
                                  email: p.email,
                                  address: p.address,
                                }}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </LiveSearchResults>
          </LiveSearch>
        </div>
        <Panel title="Register patient" className="lg:sticky lg:top-36 lg:self-start">
          <PatientQuickForm />
        </Panel>
      </div>
    </>
  )
}
