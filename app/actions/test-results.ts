'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  orderItemResults,
  orderItems,
  orders,
  reportTemplates,
  reportTemplateVisibility,
  tests,
  type OrderedTestResult,
} from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/report-template-defaults'
import { canRecordOrderItemResult, hasReadyReport } from '@/lib/order-result-readiness'

export type TestResultActionState = {
  error?: string
  success?: string
} | undefined

const DEFAULT_COLUMNS = ['parameter', 'result', 'unit', 'referenceInterval']

export async function saveOrderItemResult(
  formData: FormData,
): Promise<TestResultActionState> {
  const staff = await assertPermission('labqueue')
  const itemId = Number(formData.get('itemId'))
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return { error: 'Select a valid ordered test.' }
  }

  const [item] = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      testId: orderItems.testId,
      testCode: tests.code,
      status: orderItems.status,
      orderStatus: orders.status,
      legacyResult: orderItems.result,
      resultData: orderItemResults.resultData,
      defaultHidden: reportTemplateVisibility.hidden,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(tests, eq(tests.id, orderItems.testId))
    .leftJoin(reportTemplateVisibility, eq(reportTemplateVisibility.testId, orderItems.testId))
    .leftJoin(orderItemResults, eq(orderItemResults.orderItemId, orderItems.id))
    .where(and(
      eq(orderItems.id, itemId),
      inArray(orders.branchId, staff.branches.map((branch) => branch.id)),
    ))
    .limit(1)

  if (!item || item.orderStatus === 'cancelled') {
    return { error: 'This ordered test is unavailable.' }
  }
  if (!canRecordOrderItemResult(
    item.status,
    item.orderStatus,
    hasReadyReport(item.status, item.legacyResult, item.resultData),
  )) {
    return { error: 'Results can only be recorded on collected, processing, or completed tests without a saved result.' }
  }

  const [template] = await db
    .select({ configuration: reportTemplates.configuration })
    .from(reportTemplates)
    .where(eq(reportTemplates.testId, item.testId))
    .limit(1)

  const configuration =
    template?.configuration ??
    (item.defaultHidden ? undefined : SYSTEM_REPORT_TEMPLATES[item.testCode ?? ''])
  const parameters = configuration?.parameters.length
    ? configuration.parameters
    : [{ name: 'Result', unit: '', referenceInterval: '' }]
  if (parameters.length > 100) {
    return { error: 'The report template has too many parameters.' }
  }

  const submittedValues = formData.getAll('value')
  const submittedNames = formData.getAll('parameterName')
  if (
    submittedValues.length !== parameters.length ||
    submittedNames.length !== parameters.length ||
    submittedNames.some((name, index) => name !== parameters[index].name)
  ) {
    return { error: 'The result fields do not match the test report template. Reload and try again.' }
  }
  const values: string[] = []
  for (const submitted of submittedValues) {
    if (typeof submitted !== 'string') {
      return { error: 'Enter a value for every result field.' }
    }
    const value = submitted.trim()
    if (!value) return { error: 'Enter a value for every result field.' }
    if (value.length > 2000) return { error: 'Each result value must be 2,000 characters or fewer.' }
    values.push(value)
  }

  const resultData: OrderedTestResult = {
    columns: (configuration?.columns ?? DEFAULT_COLUMNS).filter((column) =>
      DEFAULT_COLUMNS.includes(column),
    ),
    parameters: parameters.map((parameter, index) => ({
      name: parameter.name,
      value: values[index],
      unit: parameter.unit,
      referenceInterval: parameter.referenceInterval,
    })),
  }

  try {
    await db
      .insert(orderItemResults)
      .values({
        orderItemId: item.id,
        resultData,
        updatedBy: staff.user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: orderItemResults.orderItemId,
        set: {
          resultData,
          updatedBy: staff.user.id,
          updatedAt: new Date(),
        },
      })
  } catch {
    return { error: 'Could not save this test result. Please try again.' }
  }

  revalidatePath('/lab-queue')
  revalidatePath('/orders')
  revalidatePath(`/orders/${item.orderId}`)
  return { success: 'Test result saved.' }
}
