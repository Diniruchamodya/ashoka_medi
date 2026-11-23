import Link from 'next/link'
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { doctors, orderItems, orders, patients } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { can, ORDER_STATUS_LABELS } from '@/lib/permissions'
import { colomboDate, formatDateTime, formatLKR } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, StatusBadge, paymentStatus, selectClass } from '@/components/lab/page-parts'
import { cn } from '@/lib/utils'
import { LiveSearch, LiveSearchInput, LiveSearchResults } from '@/components/search/live-search'

export const metadata: Metadata = { title: 'All Orders' }

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; date?: string }>
}) {
  const staff = await requirePermission('orders.view')
  const { q = '', status = '', date = '' } = await searchParams

  const conditions: SQL[] = [eq(orders.branchId, staff.activeBranch.id)]
  if (status && ORDER_STATUS_LABELS[status]) conditions.push(eq(orders.status, status))
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) conditions.push(sql`${colomboDate(orders.createdAt)} = ${date}::date`)
  if (q.trim()) {
    const like = `%${q.trim()}%`
    const phoneQuery = q.trim().replace(/[\s()-]/g, '')
    const searchTerms = [
      ilike(orders.orderNumber, like),
      ilike(patients.fullName, like),
      ilike(patients.patientCode, like),
    ]
    if (phoneQuery) {
      searchTerms.push(
        sql`regexp_replace(coalesce(${patients.phone}, ''), '[-[:space:]()]', '', 'g') ILIKE ${`%${phoneQuery}%`}`,
      )
    }
    conditions.push(
      or(...searchTerms)!,
    )
  }

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      paidAmount: orders.paidAmount,
      createdAt: orders.createdAt,
      patientName: patients.fullName,
      patientCode: patients.patientCode,
      doctorName: doctors.name,
      testCount: sql<number>`(select count(*)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(patients, eq(patients.id, orders.patientId))
    .leftJoin(doctors, eq(doctors.id, orders.doctorId))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(200)

  return (
    <>
      <PageHeader
        title="All Orders"
        description={`Orders placed at ${staff.activeBranch.name}.`}
        actions={
          can(staff.profile.role, 'orders.create') && (
            <Link href="/orders/new" className={buttonVariants()}>
              <Plus aria-hidden /> New order
            </Link>
          )
        }
      />

      <LiveSearch name="q" initialValue={q}>
        <form className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row">
          <LiveSearchInput
            placeholder="Search order no., patient name, phone or ID"
            ariaLabel="Search orders"
            className="sm:flex-1"
          />
          <select name="status" defaultValue={status} aria-label="Status" className={cn(selectClass, 'sm:w-40')}>
            <option value="">All statuses</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input name="date" type="date" defaultValue={date} aria-label="Order date" className="sm:w-40" />
          <button type="submit" className={buttonVariants({ variant: 'secondary' })}>
            Filter
          </button>
        </form>

        <LiveSearchResults query={q}>
          {rows.length === 0 ? (
            <EmptyState>No orders match these filters.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Doctor</th>
                    <th className="px-4 py-3 font-medium">Tests</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                          {o.orderNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.patientName}</div>
                        <div className="text-xs text-muted-foreground">{o.patientCode}</div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">{o.doctorName ?? 'Self'}</td>
                      <td className="px-4 py-3 tabular-nums">{o.testCount}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatLKR(o.total)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={paymentStatus(Number(o.total), Number(o.paidAmount))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LiveSearchResults>
      </LiveSearch>
    </>
  )
}
