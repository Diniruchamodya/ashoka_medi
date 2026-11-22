import { asc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { doctors, orderTemplates, testCategories, tests } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { PageHeader } from '@/components/lab/page-parts'
import { NewOrderForm } from '@/components/orders/new-order-form'

export const metadata: Metadata = { title: 'New Order' }

export default async function NewOrderPage() {
  const staff = await requirePermission('orders.create')

  const [testRows, categoryRows, templateRows, doctorRows] = await Promise.all([
    db
      .select({
        id: tests.id,
        code: tests.code,
        name: tests.name,
        price: tests.price,
        categoryId: tests.categoryId,
        sampleType: tests.sampleType,
        partnerId: tests.partnerId,
      })
      .from(tests)
      .where(eq(tests.active, true))
      .orderBy(asc(tests.name)),
    db.select({ id: testCategories.id, name: testCategories.name }).from(testCategories).orderBy(asc(testCategories.name)),
    db.select().from(orderTemplates).orderBy(asc(orderTemplates.name)),
    db
      .select({ id: doctors.id, name: doctors.name, hospital: doctors.hospital })
      .from(doctors)
      .orderBy(asc(doctors.name)),
  ])

  return (
    <>
      <PageHeader
        title="New Order"
        description={`Create a test order for ${staff.activeBranch.name}.`}
      />
      <NewOrderForm
        tests={testRows.map((t) => ({ ...t, price: Number(t.price) }))}
        categories={categoryRows}
        templates={templateRows.map((t) => ({ id: t.id, name: t.name, testIds: t.testIds }))}
        doctors={doctorRows}
      />
    </>
  )
}
