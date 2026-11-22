import Link from 'next/link'
import { and, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { branches, orderItems, orders, patients, payments } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { can, ROLE_LABELS, type Role } from '@/lib/permissions'
import { colomboDate, colomboToday, daysAgoInColombo, formatDateTime, formatLKR } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/lab/page-parts'
import { RevenueBars } from '@/components/dashboard/revenue-bars'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requirePermission('dashboard')
  const { denied } = await searchParams
  const branchId = staff.activeBranch.id
  const showMoney = can(staff.profile.role, 'sales')
  const since = daysAgoInColombo(6)

  const [[orderStats], [paidToday], [itemStats], recent, daily, branchSales] = await Promise.all([
    db
      .select({
        today: sql<number>`count(*) filter (where ${colomboDate(orders.createdAt)} = ${colomboToday})::int`,
        outstanding: sql<string>`coalesce(sum(greatest(${orders.total} - ${orders.paidAmount}, 0)), 0)`,
      })
      .from(orders)
      .where(and(eq(orders.branchId, branchId), ne(orders.status, 'cancelled'))),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.branchId, branchId), sql`${colomboDate(payments.createdAt)} = ${colomboToday}`)),
    db
      .select({
        open: sql<number>`count(*) filter (where ${orderItems.status} <> 'completed')::int`,
        outsourced: sql<number>`count(*) filter (where ${orderItems.status} = 'outsourced')::int`,
        completedToday: sql<number>`count(*) filter (where ${orderItems.status} = 'completed' and ${colomboDate(orderItems.completedAt)} = ${colomboToday})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.branchId, branchId), ne(orders.status, 'cancelled'))),
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
        patientName: patients.fullName,
      })
      .from(orders)
      .innerJoin(patients, eq(patients.id, orders.patientId))
      .where(eq(orders.branchId, branchId))
      .orderBy(desc(orders.createdAt))
      .limit(8),
    db
      .select({
        day: sql<string>`${colomboDate(payments.createdAt)}::text`,
        total: sql<string>`sum(${payments.amount})`,
      })
      .from(payments)
      .where(and(eq(payments.branchId, branchId), gte(colomboDate(payments.createdAt), sql`${since}::date`)))
      .groupBy(sql`1`),
    showMoney
      ? db
          .select({
            id: branches.id,
            name: branches.name,
            total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          })
          .from(branches)
          .leftJoin(
            payments,
            and(eq(payments.branchId, branches.id), sql`${colomboDate(payments.createdAt)} = ${colomboToday}`),
          )
          .where(inArray(branches.id, staff.branches.map((b) => b.id)))
          .groupBy(branches.id)
          .orderBy(branches.id)
      : Promise.resolve([]),
  ])

  const dailyMap = new Map(daily.map((d) => [d.day, Number(d.total)]))
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = daysAgoInColombo(6 - i)
    return { day, total: dailyMap.get(day) ?? 0 }
  })

  return (
    <>
      {denied && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Your role does not have access to that page.
        </p>
      )}
      <PageHeader
        title={`Welcome, ${staff.user.name.split(' ')[0]}`}
        description={`${ROLE_LABELS[staff.profile.role as Role] ?? staff.profile.role} · ${staff.activeBranch.name}`}
        actions={
          can(staff.profile.role, 'orders.create') && (
            <Link href="/orders/new" className={buttonVariants()}>
              <Plus aria-hidden /> New order
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orders today" value={orderStats?.today ?? 0} tone="primary" />
        <StatCard
          label="Tests in progress"
          value={itemStats?.open ?? 0}
          hint={`${itemStats?.outsourced ?? 0} at partner labs`}
          tone="warning"
        />
        <StatCard label="Completed today" value={itemStats?.completedToday ?? 0} tone="success" />
        {showMoney ? (
          <StatCard
            label="Collected today"
            value={formatLKR(paidToday?.total)}
            hint={`${formatLKR(orderStats?.outstanding)} outstanding`}
          />
        ) : (
          <StatCard label="Branch" value={staff.activeBranch.code} hint={staff.activeBranch.name} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel
          title="Recent orders"
          actions={
            <Link href="/orders" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState>No orders yet at this branch.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                      {o.patientName}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {o.orderNumber} · {formatDateTime(o.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={o.status} />
                  {showMoney && <span className="w-28 text-right text-sm tabular-nums">{formatLKR(o.total)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          {showMoney && (
            <Panel title="Collections · last 7 days">
              <RevenueBars days={days} />
            </Panel>
          )}
          {showMoney && branchSales.length > 1 && (
            <Panel title="Today by branch">
              <ul className="flex flex-col gap-2 text-sm">
                {branchSales.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span className={b.id === branchId ? 'font-medium' : 'text-muted-foreground'}>{b.name}</span>
                    <span className="tabular-nums">{formatLKR(b.total)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
