import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  branches,
  labPartners,
  orderItemResults,
  orderItems,
  orders,
  patients,
  reportTemplateVisibility,
  reportTemplates,
  tests,
  type OrderedTestResult,
} from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { can } from '@/lib/permissions'
import { hasLegacyReportResult, hasStructuredReportResult } from '@/lib/order-result-readiness'
import { createResultPdf } from '@/lib/result-pdf'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/report-template-defaults'
import { getStaffContext } from '@/lib/staff'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const staff = await getStaffContext()
  if (!staff?.profile || !staff.activeBranch || !can(staff.profile.role, 'orders.view')) {
    return new Response('Not found', { status: 404 })
  }

  const itemId = Number((await params).itemId)
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return new Response('Not found', { status: 404 })
  }

  const [item] = await db
    .select({
      orderNumber: orders.orderNumber,
      orderedAt: orders.createdAt,
      patientName: patients.fullName,
      patientCode: patients.patientCode,
      patientPhone: patients.phone,
      branchName: branches.name,
      branchAddress: branches.address,
      branchPhone: branches.phone,
      partnerId: orderItems.partnerId,
      partnerLabName: labPartners.name,
      testName: orderItems.testName,
      testCode: tests.code,
      itemStatus: orderItems.status,
      legacyResult: orderItems.result,
      resultData: orderItemResults.resultData,
      resultSavedAt: orderItemResults.updatedAt,
      reportConfiguration: reportTemplates.configuration,
      defaultTemplateHidden: reportTemplateVisibility.hidden,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(patients, eq(patients.id, orders.patientId))
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .leftJoin(tests, eq(tests.id, orderItems.testId))
    .leftJoin(labPartners, eq(labPartners.id, orderItems.partnerId))
    .leftJoin(orderItemResults, eq(orderItemResults.orderItemId, orderItems.id))
    .leftJoin(reportTemplates, eq(reportTemplates.testId, orderItems.testId))
    .leftJoin(reportTemplateVisibility, eq(reportTemplateVisibility.testId, orderItems.testId))
    .where(and(
      eq(orderItems.id, itemId),
      inArray(orders.branchId, staff.branches.map((branch) => branch.id)),
    ))
    .limit(1)

  if (!item) {
    return new Response('Not found', { status: 404 })
  }

  const legacyValue = item.legacyResult?.trim()
  const structuredResult = hasStructuredReportResult(item.resultData) ? item.resultData : null
  const hasLegacyResult = hasLegacyReportResult(item.itemStatus, legacyValue)
  const hasSavedResult = structuredResult || hasLegacyResult
  const configuration =
    item.reportConfiguration ??
    (!item.defaultTemplateHidden
      ? SYSTEM_REPORT_TEMPLATES[item.testCode ?? ''] ?? null
      : null)

  if (!hasSavedResult && !configuration) {
    return new Response('PDF not available yet.', { status: 404 })
  }

  const blankTemplate = !hasSavedResult
  const savedParameters = new Map(
    (structuredResult?.parameters ?? []).map((parameter) => [
      parameter.name.trim().toLowerCase(),
      parameter,
    ]),
  )
  const resultData: OrderedTestResult = structuredResult && configuration
    ? {
        columns: configuration.columns,
        parameters: configuration.parameters.map((parameter) => {
          const saved = savedParameters.get(parameter.name.trim().toLowerCase())
          return {
            ...parameter,
            value: saved?.value ?? '',
            ...(saved?.flag === undefined ? {} : { flag: saved.flag }),
          }
        }),
      }
    : structuredResult
      ? structuredResult
    : hasLegacyResult
      ? {
          columns: ['parameter', 'result'],
          parameters: [{
            name: 'Result',
            value: legacyValue!,
            unit: '',
            referenceInterval: '',
          }],
        }
      : {
          columns: configuration?.columns ?? ['parameter', 'result', 'unit', 'referenceInterval'],
          parameters: configuration?.parameters.map((parameter) => ({
            ...parameter,
            value: '',
          })) ?? [],
        }
  const pdfBytes = await createResultPdf({
    orderNumber: item.orderNumber,
    patientName: item.patientName,
    patientCode: item.patientCode,
    patientPhone: item.patientPhone,
    branchName: item.branchName,
    branchAddress: item.branchAddress,
    branchPhone: item.branchPhone,
    partnerLabName: item.partnerId ? item.partnerLabName ?? 'Outsourced' : null,
    testName: item.testName,
    testCode: item.testCode,
    orderedAt: formatDateTime(item.orderedAt),
    resultData,
    resultSavedAt: item.resultSavedAt ? formatDateTime(item.resultSavedAt) : null,
    blankTemplate,
  })
  const fileOrderNumber = item.orderNumber.replace(/[^A-Za-z0-9._-]/g, '_')
  const inline = new URL(request.url).searchParams.get('disposition') === 'inline'

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="result-${fileOrderNumber}-${itemId}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
