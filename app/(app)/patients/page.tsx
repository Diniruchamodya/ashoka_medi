import Link from 'next/link'
import { desc, ilike, or, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { orders, patients } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { ageFrom, formatDate } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { PatientQuickForm } from '@/components/orders/patient-quick-form'

export const metadata: Metadata = { title: 'Patients' }

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission('patients')
  const { q = '' } = await searchParams
  const like = `%${q.trim()}%`

  const rows = await db
    .select({
      id: patients.id,
      patientCode: patients.patientCode,
      fullName: patients.fullName,
      gender: patients.gender,
      dateOfBirth: patients.dateOfBirth,
      phone: patients.phone,
      createdAt: patients.createdAt,
      orderCount: sql<number>`(select count(*)::int from ${orders} where ${orders.patientId} = ${patients.id})`,
    })
    .from(patients)
    .where(
      q.trim()
        ? or(
            ilike(patients.fullName, like),
            ilike(patients.phone, like),
            ilike(patients.nic, like),
            ilike(patients.patientCode, like),
          )
        : undefined,
    )
    .orderBy(desc(patients.createdAt))
    .limit(100)

  return (
    <>
      <PageHeader title="Patients" description="Patient records shared across all branches." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <form className="flex gap-2 rounded-xl border border-border bg-card p-3">
            <Input name="q" defaultValue={q} placeholder="Search name, phone, NIC or patient ID" aria-label="Search patients" />
            <button type="submit" className={buttonVariants({ variant: 'secondary' })}>
              Search
            </button>
          </form>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Panel title="Register patient" className="lg:sticky lg:top-36 lg:self-start">
          <PatientQuickForm />
        </Panel>
      </div>
    </>
  )
}
