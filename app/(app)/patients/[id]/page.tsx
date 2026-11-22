import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { branches, orders, patients } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { formatDateTime, formatLKR } from '@/lib/format'
import { EmptyState, Panel, StatusBadge } from '@/components/lab/page-parts'
import { PatientEditForm } from '@/components/patients/patient-edit-form'

export const metadata: Metadata = { title: 'Patient' }

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission('patients')
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const [patient] = await db.select().from(patients).where(eq(patients.id, id))
  if (!patient) notFound()

  const history = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      branchName: branches.name,
    })
    .from(orders)
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .where(and(eq(orders.patientId, id), inArray(orders.branchId, staff.branches.map((b) => b.id))))
    .orderBy(desc(orders.createdAt))

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/patients" className="text-sm text-muted-foreground hover:text-foreground">
          ← Patients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{patient.fullName}</h1>
        <p className="text-sm text-muted-foreground">{patient.patientCode}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel title={`Order history (${history.length})`}>
          {history.length === 0 ? (
            <EmptyState>No orders yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {history.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {o.branchName} · {formatDateTime(o.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={o.status} />
                  <span className="w-28 text-right text-sm tabular-nums">{formatLKR(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Profile">
          <PatientEditForm patient={patient} />
        </Panel>
      </div>
    </>
  )
}
