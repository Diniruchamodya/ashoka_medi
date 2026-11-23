import Link from 'next/link'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import {
  branches,
  labPartners,
  orderItemResults,
  orderItemSmsNotifications,
  orderItems,
  orders,
  patients,
  reportTemplates,
  reportTemplateVisibility,
  tests,
} from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { formatDateTime } from '@/lib/format'
import { ITEM_STATUS_LABELS } from '@/lib/permissions'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/report-template-defaults'
import { hasReadyReport } from '@/lib/order-result-readiness'
import { EmptyState, PageHeader, StatusBadge } from '@/components/lab/page-parts'
import { ItemReportActions } from '@/components/orders/item-report-actions'
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
        testCode: tests.code,
        status: orderItems.status,
        result: orderItems.result,
        resultData: orderItemResults.resultData,
        smsStatus: orderItemSmsNotifications.status,
        reportConfiguration: reportTemplates.configuration,
        defaultTemplateHidden: reportTemplateVisibility.hidden,
        partnerId: orderItems.partnerId,
        partnerName: labPartners.name,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        patientName: patients.fullName,
        patientCode: patients.patientCode,
        patientPhone: patients.phone,
        branchName: branches.name,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(patients, eq(patients.id, orders.patientId))
      .innerJoin(branches, eq(branches.id, orders.branchId))
      .leftJoin(tests, eq(tests.id, orderItems.testId))
      .leftJoin(reportTemplates, eq(reportTemplates.testId, orderItems.testId))
      .leftJoin(reportTemplateVisibility, eq(reportTemplateVisibility.testId, orderItems.testId))
      .leftJoin(orderItemResults, eq(orderItemResults.orderItemId, orderItems.id))
      .leftJoin(orderItemSmsNotifications, eq(orderItemSmsNotifications.orderItemId, orderItems.id))
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
  const smsConfigured = Boolean(
    process.env.NOTIFYLK_USER_ID?.trim() &&
      process.env.NOTIFYLK_API_KEY?.trim() &&
      process.env.NOTIFYLK_SENDER_ID?.trim(),
  )

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
          {items.map((item) => {
            const configuration =
              item.reportConfiguration ??
              (!item.defaultTemplateHidden
                ? SYSTEM_REPORT_TEMPLATES[item.testCode ?? ''] ?? null
                : null)
            const reportReady = hasReadyReport(item.status, item.result, item.resultData)

            return (
              <li
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.partnerName && (
                      <span className="text-xs text-muted-foreground">via {item.partnerName}</span>
                    )}
                  </div>
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Order No</dt>
                      <dd>
                        <Link href={`/orders/${item.orderId}`} className="font-medium text-primary hover:underline">
                          {item.orderNumber}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Patient</dt>
                      <dd className="font-medium">{item.patientName} ({item.patientCode})</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Phone</dt>
                      <dd>{item.patientPhone ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Branch</dt>
                      <dd>{item.branchName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Test</dt>
                      <dd className="font-medium">
                        {item.testName}{item.testCode ? ` (${item.testCode})` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Labels</dt>
                      <dd>—</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ordered</dt>
                      <dd>{formatDateTime(item.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
                <ItemStatusForm
                  itemId={item.id}
                  status={item.status}
                  result={item.result}
                  partnerId={item.partnerId}
                  partners={partners}
                >
                  <ItemReportActions
                    itemId={item.id}
                    testName={item.testName}
                    patientPhone={item.patientPhone}
                    previewAvailable={reportReady || Boolean(configuration)}
                    reportReady={reportReady}
                    smsConfigured={smsConfigured}
                    smsStatus={item.smsStatus}
                  />
                </ItemStatusForm>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
