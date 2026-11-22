import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { branches, doctors, labPartners, orderItems, orders, patients, payments, user } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { can, PAYMENT_METHOD_LABELS } from '@/lib/permissions'
import { ageFrom, formatDateTime, formatLKR } from '@/lib/format'
import { Panel, StatusBadge, paymentStatus } from '@/components/lab/page-parts'
import { PaymentForm } from '@/components/orders/payment-form'
import { OrderActions } from '@/components/orders/order-actions'

export const metadata: Metadata = { title: 'Order Details' }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission('orders.view')
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const [order] = await db
    .select({
      order: orders,
      patient: patients,
      doctorName: doctors.name,
      branchName: branches.name,
      createdByName: user.name,
    })
    .from(orders)
    .innerJoin(patients, eq(patients.id, orders.patientId))
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .leftJoin(doctors, eq(doctors.id, orders.doctorId))
    .leftJoin(user, eq(user.id, orders.createdBy))
    .where(and(eq(orders.id, id), inArray(orders.branchId, staff.branches.map((b) => b.id))))
  if (!order) notFound()

  const [items, paymentRows] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        testName: orderItems.testName,
        price: orderItems.price,
        status: orderItems.status,
        result: orderItems.result,
        partnerName: labPartners.name,
        completedAt: orderItems.completedAt,
      })
      .from(orderItems)
      .leftJoin(labPartners, eq(labPartners.id, orderItems.partnerId))
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id)),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        createdAt: payments.createdAt,
        receivedByName: user.name,
      })
      .from(payments)
      .leftJoin(user, eq(user.id, payments.receivedBy))
      .where(eq(payments.orderId, id))
      .orderBy(asc(payments.createdAt)),
  ])

  const o = order.order
  const total = Number(o.total)
  const paid = Number(o.paidAmount)
  const balance = Math.max(total - paid, 0)
  const age = ageFrom(order.patient.dateOfBirth)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground print:hidden">
            ← All orders
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{o.orderNumber}</h1>
            <StatusBadge status={o.status} />
            <StatusBadge status={paymentStatus(total, paid)} />
          </div>
          <p className="text-sm text-muted-foreground">
            {order.branchName} · {formatDateTime(o.createdAt)}
            {order.createdByName && ` · by ${order.createdByName}`}
          </p>
        </div>
        <OrderActions
          orderId={o.id}
          canCancel={can(staff.profile.role, 'orders.create') && o.status !== 'completed' && o.status !== 'cancelled'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Patient">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">
                  <Link href={`/patients/${order.patient.id}`} className="hover:underline">
                    {order.patient.fullName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Patient ID</dt>
                <dd className="font-medium">{order.patient.patientCode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Age / Gender</dt>
                <dd className="font-medium capitalize">
                  {age !== null ? `${age} yrs` : '—'} / {order.patient.gender ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{order.patient.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Referred by</dt>
                <dd className="font-medium">{order.doctorName ?? 'Self / walk-in'}</dd>
              </div>
              {o.notes && (
                <div>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="font-medium">{o.notes}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title={`Tests (${items.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="pb-2 font-medium">Test</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Result</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{item.testName}</div>
                        {item.partnerName && (
                          <div className="text-xs text-muted-foreground">via {item.partnerName}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{item.result ?? '—'}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatLKR(item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Billing">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatLKR(o.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="tabular-nums">− {formatLKR(o.discount)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatLKR(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="tabular-nums">{formatLKR(paid)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{formatLKR(balance)}</dd>
              </div>
            </dl>
            {balance > 0 && o.status !== 'cancelled' && can(staff.profile.role, 'sales') && (
              <div className="print:hidden">
                <PaymentForm orderId={o.id} balance={balance} />
              </div>
            )}
          </Panel>

          <Panel title="Payments">
            {paymentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {paymentRows.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                        {p.receivedByName && ` · ${p.receivedByName}`}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums">{formatLKR(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
