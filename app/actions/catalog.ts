'use server'

import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { doctors, labPartners, orderTemplates, testCategories, tests } from '@/lib/db/schema'
import { assertPermission } from '@/lib/staff'

export type CrudState =
  | { error?: string; phoneError?: string; passwordError?: string; success?: string; nonce?: number }
  | undefined

const text = (fd: FormData, key: string, max = 200) => {
  const v = String(fd.get(key) ?? '').trim().slice(0, max)
  return v || null
}
const idOf = (fd: FormData) => {
  const n = Number(fd.get('id'))
  return Number.isInteger(n) && n > 0 ? n : null
}
const ok = (success: string): CrudState => ({ success, nonce: Date.now() })

function dbError(error: unknown): CrudState {
  console.error('[catalog]', error)
  const msg = String((error as { cause?: { code?: string } })?.cause?.code ?? '')
  return { error: msg === '23505' ? 'That name or code already exists.' : 'Could not save. Please try again.' }
}

export async function saveCategory(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('categories')
  const id = idOf(fd)
  const name = text(fd, 'name')
  if (!name) return { error: 'Category name is required.' }
  const values = { name, description: text(fd, 'description', 500) }
  try {
    if (id) await db.update(testCategories).set(values).where(eq(testCategories.id, id))
    else await db.insert(testCategories).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/categories')
  return ok(id ? 'Category updated.' : 'Category added.')
}

export async function deleteCategory(fd: FormData) {
  await assertPermission('categories')
  const id = idOf(fd)
  if (!id) return
  await db.update(tests).set({ categoryId: null }).where(eq(tests.categoryId, id))
  await db.delete(testCategories).where(eq(testCategories.id, id))
  revalidatePath('/categories')
}

export async function saveTest(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('categories')
  const id = idOf(fd)
  const name = text(fd, 'name')
  const code = text(fd, 'code', 30)?.toUpperCase()
  const price = Number(fd.get('price'))
  const turnaround = Number(fd.get('turnaroundHours') || 24)
  const categoryId = Number(fd.get('categoryId')) || null
  const partnerId = Number(fd.get('partnerId')) || null
  if (!name || !code) return { error: 'Test name and code are required.' }
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { error: 'Enter a valid price.' }
  if (!Number.isInteger(turnaround) || turnaround < 1 || turnaround > 2000) {
    return { error: 'Turnaround must be between 1 and 2000 hours.' }
  }
  const values = {
    name,
    code,
    price: price.toFixed(2),
    turnaroundHours: turnaround,
    categoryId,
    partnerId,
    sampleType: text(fd, 'sampleType', 60),
    active: fd.get('active') !== 'off',
  }
  try {
    if (id) await db.update(tests).set(values).where(eq(tests.id, id))
    else await db.insert(tests).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/categories')
  return ok(id ? 'Test updated.' : 'Test added.')
}

export async function deleteTest(fd: FormData) {
  await assertPermission('categories')
  const id = idOf(fd)
  if (!id) return
  // Tests referenced by past orders are deactivated instead of deleted to keep history intact.
  await db.update(tests).set({ active: false }).where(eq(tests.id, id))
  revalidatePath('/categories')
}

export async function saveDoctor(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('doctors')
  const id = idOf(fd)
  const name = text(fd, 'name')
  if (!name) return { error: 'Doctor name is required.' }
  const values = {
    name,
    specialty: text(fd, 'specialty'),
    hospital: text(fd, 'hospital'),
    phone: text(fd, 'phone', 30),
    email: text(fd, 'email'),
  }
  try {
    if (id) await db.update(doctors).set(values).where(eq(doctors.id, id))
    else await db.insert(doctors).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/doctors')
  return ok(id ? 'Doctor updated.' : 'Doctor added.')
}

export async function deleteDoctor(fd: FormData) {
  await assertPermission('doctors')
  const id = idOf(fd)
  if (id) await db.delete(doctors).where(eq(doctors.id, id))
  revalidatePath('/doctors')
}

export async function savePartner(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('partners')
  const id = idOf(fd)
  const name = text(fd, 'name')
  if (!name) return { error: 'Partner name is required.' }
  const values = {
    name,
    contactPerson: text(fd, 'contactPerson'),
    phone: text(fd, 'phone', 30),
    email: text(fd, 'email'),
    address: text(fd, 'address', 500),
    active: fd.get('active') !== 'off',
  }
  try {
    if (id) await db.update(labPartners).set(values).where(eq(labPartners.id, id))
    else await db.insert(labPartners).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/partners')
  return ok(id ? 'Partner updated.' : 'Partner added.')
}

export async function deletePartner(fd: FormData) {
  await assertPermission('partners')
  const id = idOf(fd)
  if (!id) return
  await db.update(labPartners).set({ active: false }).where(eq(labPartners.id, id))
  revalidatePath('/partners')
}

export async function saveTemplate(_: CrudState, fd: FormData): Promise<CrudState> {
  await assertPermission('templates')
  const id = idOf(fd)
  const name = text(fd, 'name')
  const requested = fd.getAll('testIds').map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (!name) return { error: 'Template name is required.' }
  if (requested.length === 0) return { error: 'Select at least one test.' }
  const valid = await db
    .select({ id: tests.id })
    .from(tests)
    .where(inArray(tests.id, [...new Set(requested)]))
  const values = { name, description: text(fd, 'description', 500), testIds: valid.map((t) => t.id) }
  try {
    if (id) await db.update(orderTemplates).set(values).where(eq(orderTemplates.id, id))
    else await db.insert(orderTemplates).values(values)
  } catch (e) {
    return dbError(e)
  }
  revalidatePath('/templates')
  return ok(id ? 'Template updated.' : 'Template added.')
}

export async function deleteTemplate(fd: FormData) {
  await assertPermission('templates')
  const id = idOf(fd)
  if (id) await db.delete(orderTemplates).where(eq(orderTemplates.id, id))
  revalidatePath('/templates')
}
