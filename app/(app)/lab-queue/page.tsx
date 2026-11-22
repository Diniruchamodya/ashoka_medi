import Link from 'next/link'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { labPartners, orderItems, orders, patients } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { formatDateTime } from '@/lib/format'
import { ITEM_STATUS_LABELS } from '@/lib/permissions'
import { EmptyState, PageHeader, StatusBadge } from '@/components/lab/page-parts'
import { ItemStatusForm } from '@/components/orders/item-status-form'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Lab Queue' }

const FILTERS = ['active', 'pending', 'sample_collected', 'processing', 'outsourced'] as const

export default async function LabQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const staff = await requirePermission('labqueue')
  const { status = 'active' } = await searchParams
  const filter = (FILTERS as readonly string[]).includes(status) ? status : 'active'

  const statusCondition =
    filter === 'active' ? ne(orderItems.status, 'completed') : eq(orderItems.status, filter)

  const [items, partners, counts] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        testName: orderItems.testName,
        status: orderItems.status,
        result: orderItems.result,
        partnerId: orderItems.partnerId,
        partnerName: labPartners.name,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        patientName: patients.fullName,
        patientCode: patients.patientCode,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(patients, eq(patients.id, orders.patientId))
      .leftJoin(labPartners, eq(labPartners.id, orderItems.partnerId))
      .where(
        and(
          eq(orders.branchId, staff.activeBranch.id),
          ne(orders.status, 'cancelled'),
          statusCondition,
        ),
      )
      .orderBy(asc(orders.createdAt), asc(orderItems.id))
      .limit(200),
    db
      .select({ id: labPartners.id, name: labPartners.name })
      .from(labPartners)
      .where(eq(labPartners.active, true))
      .orderBy(asc(labPartners.name)),
    db
      .select({ status: orderItems.status, count: sql<number>`count(*)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.branchId, staff.activeBranch.id),
          ne(orders.status, 'cancelled'),
          inArray(orderItems.status, ['pending', 'sample_collected', 'processing', 'outsourced']),
        ),
      )
      .groupBy(orderItems.status),
  ])

  const countMap = new Map(counts.map((c) => [c.status, c.count]))
  const activeTotal = counts.reduce((s, c) => s + c.count, 0)

  return (
    <>
      <PageHeader
        title="Lab Queue"
        description={`Tests awaiting work at ${staff.activeBranch.name}. Update each test as it moves through the lab.`}
      />

      <nav aria-label="Queue filters" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f === 'active' ? activeTotal : (countMap.get(f) ?? 0)
          return (
            <Link
              key={f}
              href={f === 'active' ? '/lab-queue' : `/lab-queue?status=${f}`}
              aria-current={filter === f ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium',
                filter === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-muted',
              )}
            >
              {f === 'active' ? 'All active' : ITEM_STATUS_LABELS[f]}
              <span className="tabular-nums opacity-80">{count}</span>
            </Link>
          )
        })}
      </nav>

      {items.length === 0 ? (
        <EmptyState>Nothing in the queue. All caught up.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{item.testName}</span>
                  <StatusBadge status={item.status} />
                  {item.partnerName && (
                    <span className="text-xs text-muted-foreground">via {item.partnerName}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.patientName} ({item.patientCode}) ·{' '}
                  <Link href={`/orders/${item.orderId}`} className="font-medium text-primary hover:underline">
                    {item.orderNumber}
                  </Link>{' '}
                  · {formatDateTime(item.createdAt)}
                </p>
              </div>
              <ItemStatusForm
                itemId={item.id}
                status={item.status}
                result={item.result}
                partnerId={item.partnerId}
                partners={partners}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
