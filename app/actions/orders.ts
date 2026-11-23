'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { doctors, labPartners, orderItems, orders, patients, payments, tests } from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import { ITEM_STATUSES, PAYMENT_METHODS } from '@/lib/permissions'

export type ActionState =
  | {
      error?: string
      success?: string
      fieldErrors?: {
        branchId?: string
        patientId?: string
        testIds?: string
        doctorId?: string
        partnerId?: string
        discount?: string
        paymentAmount?: string
        paymentMethod?: string
      }
    }
  | undefined

function money(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN
}

export async function searchPatients(query: string) {
  const staff = await assertPermission('orders.create')
  void staff
  const q = query.trim()
  if (q.length < 2) return []
  const like = `%${q}%`
  const phoneQuery = q.replace(/[\s()-]/g, '')
  const searchTerms = [
    ilike(patients.fullName, like),
    ilike(patients.patientCode, like),
    ilike(patients.nic, like),
    ilike(patients.email, like),
  ]
  if (phoneQuery) {
    searchTerms.push(
      sql`regexp_replace(coalesce(${patients.phone}, ''), '[-[:space:]()]', '', 'g') ILIKE ${`%${phoneQuery}%`}`,
    )
  }
  return db
    .select({
      id: patients.id,
      patientCode: patients.patientCode,
      fullName: patients.fullName,
      phone: patients.phone,
    })
    .from(patients)
    .where(or(...searchTerms))
    .limit(8)
}

type CreateOrderInput = {
  patientId: number
  doctorId: number | null
  testIds: number[]
  discount: number
  paymentAmount: number
  paymentMethod: string
  notes: string
}

export async function createOrder(input: CreateOrderInput): Promise<ActionState> {
  const staff = await assertPermission('orders.create')

  if (!staff.branches.some((branch) => branch.id === staff.activeBranch.id)) {
    return { error: 'Your active branch is not accessible.', fieldErrors: { branchId: 'Choose an accessible branch.' } }
  }
  const requestedTestIds = Array.isArray(input.testIds) ? input.testIds : []
  const testIds = [...new Set(requestedTestIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
  if (!Number.isSafeInteger(input.patientId) || input.patientId <= 0) {
    return { error: 'Select a registered patient.', fieldErrors: { patientId: 'Select a valid patient.' } }
  }
  if (testIds.length === 0) {
    return { error: 'Choose at least one test.', fieldErrors: { testIds: 'Select at least one test.' } }
  }
  if (requestedTestIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
    return { error: 'Select valid tests.', fieldErrors: { testIds: 'One or more selected tests are invalid.' } }
  }
  if (testIds.length > 60) {
    return { error: 'An order can include at most 60 tests.', fieldErrors: { testIds: 'Select no more than 60 tests.' } }
  }

  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, input.patientId))
  if (!patient) {
    return { error: 'Patient not found.', fieldErrors: { patientId: 'Select an existing registered patient.' } }
  }

  if (input.doctorId !== null && (!Number.isSafeInteger(input.doctorId) || input.doctorId <= 0)) {
    return { error: 'Select a valid referring doctor.', fieldErrors: { doctorId: 'Select a valid referring doctor.' } }
  }
  if (input.doctorId !== null) {
    const [doctor] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.id, input.doctorId))
      .limit(1)
    if (!doctor) {
      return { error: 'The selected referring doctor is unavailable.', fieldErrors: { doctorId: 'Choose an available doctor.' } }
    }
  }

  const selected = await db
    .select()
    .from(tests)
    .where(and(inArray(tests.id, testIds), eq(tests.active, true)))
  if (selected.length !== testIds.length) {
    return { error: 'Some selected tests are unavailable.', fieldErrors: { testIds: 'One or more selected tests are unavailable.' } }
  }
  const partnerIds = [...new Set(selected.flatMap((test) => test.partnerId ? [test.partnerId] : []))]
  if (partnerIds.length > 0) {
    const availablePartners = await db
      .select({ id: labPartners.id })
      .from(labPartners)
      .where(and(inArray(labPartners.id, partnerIds), eq(labPartners.active, true)))
    if (availablePartners.length !== partnerIds.length) {
      return {
        error: 'A selected test has an unavailable lab partner.',
        fieldErrors: { partnerId: 'A selected test is assigned to an unavailable lab partner.' },
      }
    }
  }

  const subtotal = selected.reduce((sum, t) => sum + Number(t.price), 0)
  const discount = money(input.discount ?? 0)
  if (Number.isNaN(discount) || discount > subtotal) {
    return { error: 'Discount is not valid.', fieldErrors: { discount: 'Enter a valid discount.' } }
  }
  const total = Math.round((subtotal - discount) * 100) / 100
  const paymentAmount = money(input.paymentAmount ?? 0)
  if (Number.isNaN(paymentAmount) || paymentAmount > total) {
    return { error: 'Payment cannot exceed the order total.', fieldErrors: { paymentAmount: 'Enter a valid payment not exceeding the order total.' } }
  }
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) {
    return { error: 'Select a valid payment method.', fieldErrors: { paymentMethod: 'Select a valid payment method.' } }
  }
  const method = input.paymentMethod

  const branch = staff.activeBranch
  let orderId = 0

  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          orderNumber: `TMP-${crypto.randomUUID()}`,
          branchId: branch.id,
          patientId: patient.id,
          doctorId: input.doctorId,
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          paidAmount: paymentAmount.toFixed(2),
          notes: input.notes?.trim().slice(0, 1000) || null,
          createdBy: staff.user.id,
        })
        .returning({ id: orders.id })
      orderId = created.id

      await tx
        .update(orders)
        .set({ orderNumber: `${branch.code}-${String(created.id).padStart(6, '0')}` })
        .where(eq(orders.id, created.id))

      await tx.insert(orderItems).values(
        selected.map((t) => ({
          orderId: created.id,
          testId: t.id,
          testName: t.name,
          price: t.price,
          partnerId: t.partnerId,
          status: t.partnerId ? 'outsourced' : 'pending',
        })),
      )

      if (paymentAmount > 0) {
        await tx.insert(payments).values({
          orderId: created.id,
          branchId: branch.id,
          amount: paymentAmount.toFixed(2),
          method,
          receivedBy: staff.user.id,
        })
      }
    })
  } catch (error) {
    console.error('[orders] create failed', error)
    return { error: 'Could not create the order. No order or payment was saved.' }
  }

  revalidatePath('/', 'layout')
  redirect(`/orders/${orderId}`)
}

async function loadScopedOrder(orderId: number, branchIds: number[]) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), inArray(orders.branchId, branchIds)))
  return order ?? null
}

async function refreshOrderStatus(orderId: number) {
  const items = await db
    .select({ status: orderItems.status })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
  const allDone = items.length > 0 && items.every((i) => i.status === 'completed')
  const anyStarted = items.some((i) => i.status !== 'pending')
  await db
    .update(orders)
    .set({
      status: allDone ? 'completed' : anyStarted ? 'in_progress' : 'pending',
      completedAt: allDone ? sql`now()` : null,
    })
    .where(and(eq(orders.id, orderId), ne(orders.status, 'cancelled')))
}

export async function updateItemStatus(formData: FormData) {
  const staff = await assertPermission('labqueue')
  const itemId = Number(formData.get('itemId'))
  const status = String(formData.get('status'))
  const result = String(formData.get('result') ?? '').trim().slice(0, 2000)
  const partnerIdRaw = formData.get('partnerId')
  if (!(ITEM_STATUSES as readonly string[]).includes(status)) throw new Error('Invalid status')

  const [item] = await db.select().from(orderItems).where(eq(orderItems.id, itemId))
  if (!item) throw new Error('Not found')
  const order = await loadScopedOrder(item.orderId, staff.branches.map((b) => b.id))
  if (!order || order.status === 'cancelled') throw new Error('Forbidden')

  let partnerId = item.partnerId
  if (status === 'outsourced') {
    const pid = Number(partnerIdRaw)
    const [partner] = Number.isInteger(pid)
      ? await db.select({ id: labPartners.id }).from(labPartners).where(eq(labPartners.id, pid))
      : []
    if (!partner && !item.partnerId) throw new Error('Choose a partner lab')
    partnerId = partner?.id ?? item.partnerId
  }

  await db
    .update(orderItems)
    .set({
      status,
      partnerId,
      result: status === 'completed' ? result || item.result || 'Completed' : result || item.result,
      updatedBy: staff.user.id,
      updatedAt: sql`now()`,
      completedAt: status === 'completed' ? sql`now()` : null,
    })
    .where(eq(orderItems.id, itemId))

  await refreshOrderStatus(item.orderId)
  revalidatePath('/', 'layout')
}

export async function recordPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await assertPermission('sales')
  const orderId = Number(formData.get('orderId'))
  const amount = money(formData.get('amount'))
  const methodRaw = String(formData.get('method'))
  const method = (PAYMENT_METHODS as readonly string[]).includes(methodRaw) ? methodRaw : 'cash'

  const order = await loadScopedOrder(orderId, staff.branches.map((b) => b.id))
  if (!order) return { error: 'Order not found.' }
  if (order.status === 'cancelled') return { error: 'This order is cancelled.' }
  const balance = Number(order.total) - Number(order.paidAmount)
  if (Number.isNaN(amount) || amount <= 0) return { error: 'Enter a valid amount.' }
  if (amount > balance + 0.001) return { error: 'Amount exceeds the outstanding balance.' }

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      orderId,
      branchId: order.branchId,
      amount: amount.toFixed(2),
      method,
      receivedBy: staff.user.id,
    })
    await tx
      .update(orders)
      .set({ paidAmount: sql`${orders.paidAmount} + ${amount.toFixed(2)}::numeric` })
      .where(eq(orders.id, orderId))
  })

  revalidatePath('/', 'layout')
  return { success: 'Payment recorded.' }
}

export async function cancelOrder(formData: FormData) {
  const staff = await assertPermission('orders.create')
  const orderId = Number(formData.get('orderId'))
  const order = await loadScopedOrder(orderId, staff.branches.map((b) => b.id))
  if (!order || order.status === 'completed') throw new Error('Cannot cancel this order')
  await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId))
  revalidatePath('/', 'layout')
}
