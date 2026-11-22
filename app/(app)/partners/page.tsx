import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { labPartners, orderItems, orders } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { PartnerForm } from '@/components/catalog/catalog-forms'
import { DeleteButton, EditToggle } from '@/components/lab/crud-form'
import { deletePartner } from '@/app/actions/catalog'

export const metadata: Metadata = { title: 'Lab Partners' }

export default async function PartnersPage() {
  const staff = await requirePermission('partners')
  const branchIds = staff.branches.map((b) => b.id)

  const rows = await db
    .select({
      partner: labPartners,
      open: sql<number>`count(*) filter (where ${orderItems.status} = 'outsourced')::int`,
      done: sql<number>`count(*) filter (where ${orderItems.status} = 'completed')::int`,
    })
    .from(labPartners)
    .leftJoin(orderItems, eq(orderItems.partnerId, labPartners.id))
    .leftJoin(orders, and(eq(orders.id, orderItems.orderId), inArray(orders.branchId, branchIds)))
    .where(eq(labPartners.active, true))
    .groupBy(labPartners.id)
    .orderBy(asc(labPartners.name))

  return (
    <>
      <PageHeader title="Lab Partners" description="External laboratories that receive outsourced tests." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title={`Partner laboratories (${rows.length})`}>
          {rows.length === 0 ? (
            <EmptyState>No partner labs yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map(({ partner: p, open, done }) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[p.contactPerson, p.phone, p.email].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-sm">
                    <span className="font-medium tabular-nums">{open} at partner</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{done} completed</span>
                  </div>
                  <EditToggle label={`Edit ${p.name}`}>
                    <PartnerForm partner={p} />
                  </EditToggle>
                  <DeleteButton
                    action={deletePartner}
                    id={p.id}
                    label={`Remove ${p.name}`}
                    confirmText={`Remove ${p.name} from partner labs?`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Add partner" className="lg:sticky lg:top-36 lg:self-start">
          <PartnerForm />
        </Panel>
      </div>
    </>
  )
}
