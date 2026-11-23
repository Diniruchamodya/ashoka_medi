'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  orderItemResults,
  orderItemSmsNotifications,
  orderItems,
  orders,
  patients,
} from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import { hasReadyReport } from '@/lib/order-result-readiness'
import { normalizeSriLankanMobileForSms } from '@/lib/phone-validation'

export type ReportSmsActionState = {
  error?: string
  success?: string
  pending?: boolean
  submitted?: boolean
} | undefined

function isSuccessResponse(value: unknown): value is { status: 'success' } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'status' in value &&
      value.status === 'success',
  )
}

export async function sendReportReadySms(itemId: number): Promise<ReportSmsActionState> {
  const staff = await assertPermission('labqueue')
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return { error: 'Select a valid ordered test.' }
  }

  const userId = process.env.NOTIFYLK_USER_ID?.trim()
  const apiKey = process.env.NOTIFYLK_API_KEY?.trim()
  const senderId = process.env.NOTIFYLK_SENDER_ID?.trim()
  if (!userId || !apiKey || !senderId) {
    return { error: 'SMS service is not configured.' }
  }

  const [item] = await db
    .select({
      status: orderItems.status,
      legacyResult: orderItems.result,
      orderStatus: orders.status,
      resultData: orderItemResults.resultData,
      patientPhone: patients.phone,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(patients, eq(patients.id, orders.patientId))
    .leftJoin(orderItemResults, eq(orderItemResults.orderItemId, orderItems.id))
    .where(and(
      eq(orderItems.id, itemId),
      inArray(orders.branchId, staff.branches.map((branch) => branch.id)),
    ))
    .limit(1)

  if (!item || item.orderStatus === 'cancelled') {
    return { error: 'This ordered test is unavailable.' }
  }
  if (!hasReadyReport(item.status, item.legacyResult, item.resultData)) {
    return { error: 'This report is not ready for collection.' }
  }

  const recipient = item.patientPhone
    ? normalizeSriLankanMobileForSms(item.patientPhone)
    : undefined
  if (!recipient) {
    return { error: 'The patient mobile number is missing or invalid.' }
  }

  const [claim] = await db
    .insert(orderItemSmsNotifications)
    .values({ orderItemId: itemId, submittedBy: staff.user.id })
    .onConflictDoNothing()
    .returning({ orderItemId: orderItemSmsNotifications.orderItemId })

  if (!claim) {
    const [existing] = await db
      .select({ status: orderItemSmsNotifications.status })
      .from(orderItemSmsNotifications)
      .where(eq(orderItemSmsNotifications.orderItemId, itemId))
      .limit(1)
    if (existing?.status === 'submitted') {
      return { error: 'An SMS has already been submitted for this test.', submitted: true }
    }
    return {
      error: 'An SMS submission is already in progress for this test.',
      pending: true,
    }
  }

  let response: Response
  try {
    response = await fetch('https://app.notify.lk/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        user_id: userId,
        api_key: apiKey,
        sender_id: senderId,
        to: recipient,
        message: 'Report is ready',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    return {
      error: 'SMS submission could not be confirmed. Contact an administrator before retrying.',
      pending: true,
    }
  }

  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    return {
      error: 'SMS submission could not be confirmed. Contact an administrator before retrying.',
      pending: true,
    }
  }

  if (!response.ok) {
    return {
      error: 'SMS submission could not be confirmed. Contact an administrator before retrying.',
      pending: true,
    }
  }

  if (!isSuccessResponse(responseBody)) {
    try {
      await db
        .delete(orderItemSmsNotifications)
        .where(and(
          eq(orderItemSmsNotifications.orderItemId, itemId),
          eq(orderItemSmsNotifications.status, 'pending'),
        ))
    } catch {
      return {
        error: 'Notify.lk rejected the SMS, but retry protection could not be cleared. Contact an administrator.',
        pending: true,
      }
    }
    return { error: 'Notify.lk rejected the SMS. Please try again.' }
  }

  try {
    await db
      .update(orderItemSmsNotifications)
      .set({ status: 'submitted', submittedAt: new Date() })
      .where(eq(orderItemSmsNotifications.orderItemId, itemId))
  } catch {
    return {
      error: 'Notify.lk accepted the SMS, but its submission could not be recorded. Do not retry; contact an administrator.',
      pending: true,
    }
  }

  return { success: 'SMS submitted' }
}
