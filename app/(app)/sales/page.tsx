import Link from 'next/link'
import { and, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { branches, orders, patients, payments, user } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { PAYMENT_METHOD_LABELS } from '@/lib/permissions'
import { colomboDate, daysAgoInColombo, formatDateTime, formatLKR, todayInColombo } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, Panel, StatCard, selectClass } from '@/components/lab/page-parts'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sales' }

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>
}) {
  const staff = await requirePermission('sales')
  const sp = await searchParams
  const from = isDate(sp.from) ? sp.from! : daysAgoInColombo(29)
  const to = isDate(sp.to) ? sp.to! : todayInColombo()
  const accessible = staff.branches.map((b) => b.id)
  const selectedBranch = sp.branch === 'all' ? 'all' : Number(sp.branch) || staff.activeBranch.id
  const branchIds =
    selectedBranch === 'all' ? accessible : accessible.includes(selectedBranch) ? [selectedBranch] : [staff.activeBranch.id]

  const paymentRange = and(
    inArray(payments.branchId, branchIds),
    gte(colomboDate(payments.createdAt), sql`${from}::date`),
    lte(colomboDate(payments.createdAt), sql`${to}::date`),
  )
  const orderRange = and(
    inArray(orders.branchId, branchIds),
    ne(orders.status, 'cancelled'),
    gte(colomboDate(orders.createdAt), sql`${from}::date`),
    lte(colomboDate(orders.createdAt), sql`${to}::date`),
  )

  const [[billing], [collected], byMethod, byBranch, recentPayments] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        gross: sql<string>`coalesce(sum(${orders.subtotal}), 0)`,
        discount: sql<string>`coalesce(sum(${orders.discount}), 0)`,
        net: sql<string>`coalesce(sum(${orders.total}), 0)`,
        outstanding: sql<string>`coalesce(sum(greatest(${orders.total} - ${orders.paidAmount}, 0)), 0)`,
      })
      .from(orders)
      .where(orderRange),
    db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(paymentRange),
    db
      .select({ method: payments.method, total: sql<string>`sum(${payments.amount})`, count: sql<number>`count(*)::int` })
      .from(payments)
      .where(paymentRange)
      .groupBy(payments.method),
    db
      .select({ id: branches.id, name: branches.name, total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(branches)
      .leftJoin(
        payments,
        and(
          eq(payments.branchId, branches.id),
          gte(colomboDate(payments.createdAt), sql`${from}::date`),
          lte(colomboDate(payments.createdAt), sql`${to}::date`),
        ),
      )
      .where(inArray(branches.id, branchIds))
      .groupBy(branches.id)
      .orderBy(branches.id),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        createdAt: payments.createdAt,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        patientName: patients.fullName,
        branchName: branches.name,
        receivedBy: user.name,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(patients, eq(patients.id, orders.patientId))
      .innerJoin(branches, eq(branches.id, payments.branchId))
      .leftJoin(user, eq(user.id, payments.receivedBy))
      .where(paymentRange)
      .orderBy(desc(payments.createdAt))
      .limit(100),
  ])

  const collectedTotal = Number(collected?.total ?? 0)

  return (
    <>
      <PageHeader title="Sales" description="Billing and collections across your branches." />

      <form className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <Input type="date" name="from" defaultValue={from} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <Input type="date" name="to" defaultValue={to} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium sm:w-56">
          Branch
          <select name="branch" defaultValue={String(selectedBranch)} className={selectClass}>
            {staff.branches.length > 1 && <option value="all">All my branches</option>}
            {staff.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={cn(buttonVariants({ variant: 'secondary' }), 'sm:ml-auto')}>
          Apply
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Collected" value={formatLKR(collectedTotal)} tone="success" />
        <StatCard label="Net billed" value={formatLKR(billing?.net)} hint={`${billing?.count ?? 0} orders`} tone="primary" />
        <StatCard label="Discounts" value={formatLKR(billing?.discount)} hint={`Gross ${formatLKR(billing?.gross)}`} />
        <StatCard label="Outstanding" value={formatLKR(billing?.outstanding)} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="By payment method">
          {byMethod.length === 0 ? (
            <EmptyState>No payments in this period.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {byMethod.map((m) => {
                const pct = collectedTotal ? (Number(m.total) / collectedTotal) * 100 : 0
                return (
                  <li key={m.method} className="flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between">
                      <span>
                        {PAYMENT_METHOD_LABELS[m.method] ?? m.method}{' '}
                        <span className="text-muted-foreground">({m.count})</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatLKR(m.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
        <Panel title="By branch">
          <ul className="flex flex-col gap-2 text-sm">
            {byBranch.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span>{b.name}</span>
                <span className="font-medium tabular-nums">{formatLKR(b.total)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Payments">
        {recentPayments.length === 0 ? (
          <EmptyState>No payments in this period.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Order</th>
                  <th className="pb-2 font-medium">Patient</th>
                  <th className="hidden pb-2 font-medium md:table-cell">Branch</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                    <td className="py-2.5 pr-3">
                      <Link href={`/orders/${p.orderId}`} className="font-medium text-primary hover:underline">
                        {p.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">{p.patientName}</td>
                    <td className="hidden py-2.5 pr-3 md:table-cell">{p.branchName}</td>
                    <td className="py-2.5 pr-3">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{formatLKR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
