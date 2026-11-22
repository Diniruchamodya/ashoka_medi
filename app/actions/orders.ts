'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { labPartners, orderItems, orders, patients, payments, tests } from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'
import { ITEM_STATUSES, PAYMENT_METHODS } from '@/lib/permissions'

export type ActionState = { error?: string; success?: string } | undefined

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
  return db
    .select({
      id: patients.id,
      patientCode: patients.patientCode,
      fullName: patients.fullName,
      phone: patients.phone,
      gender: patients.gender,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .where(
      or(
        ilike(patients.fullName, like),
        ilike(patients.phone, like),
        ilike(patients.patientCode, like),
        ilike(patients.nic, like),
      ),
    )
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

  const testIds = [...new Set(input.testIds.map(Number).filter(Number.isInteger))]
  if (!Number.isInteger(input.patientId)) return { error: 'Select or register a patient.' }
  if (testIds.length === 0) return { error: 'Choose at least one test.' }
  if (testIds.length > 60) return { error: 'An order can include at most 60 tests.' }

  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, input.patientId))
  if (!patient) return { error: 'Patient not found.' }

  const selected = await db
    .select()
    .from(tests)
    .where(and(inArray(tests.id, testIds), eq(tests.active, true)))
  if (selected.length !== testIds.length) return { error: 'Some selected tests are unavailable.' }

  const subtotal = selected.reduce((sum, t) => sum + Number(t.price), 0)
  const discount = money(input.discount || 0)
  if (Number.isNaN(discount) || discount > subtotal) return { error: 'Discount is not valid.' }
  const total = Math.round((subtotal - discount) * 100) / 100
  const paymentAmount = money(input.paymentAmount || 0)
  if (Number.isNaN(paymentAmount) || paymentAmount > total) {
    return { error: 'Payment cannot exceed the order total.' }
  }
  const method = (PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)
    ? input.paymentMethod
    : 'cash'

  const branch = staff.activeBranch
  let orderId = 0

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        orderNumber: `TMP-${crypto.randomUUID()}`,
        branchId: branch.id,
        patientId: patient.id,
        doctorId: input.doctorId && Number.isInteger(input.doctorId) ? input.doctorId : null,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        paidAmount: paymentAmount.toFixed(2),
        notes: input.notes?.slice(0, 1000) || null,
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
