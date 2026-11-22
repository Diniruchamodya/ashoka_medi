import { asc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { labPartners, testCategories, tests } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { formatLKR } from '@/lib/format'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { CategoryForm, TestForm } from '@/components/catalog/catalog-forms'
import { DeleteButton, EditToggle } from '@/components/lab/crud-form'
import { deleteCategory, deleteTest } from '@/app/actions/catalog'

export const metadata: Metadata = { title: 'Test Categories' }

export default async function CategoriesPage() {
  await requirePermission('categories')

  const [categories, testRows, partners] = await Promise.all([
    db.select().from(testCategories).orderBy(asc(testCategories.name)),
    db.select().from(tests).where(eq(tests.active, true)).orderBy(asc(tests.name)),
    db
      .select({ id: labPartners.id, name: labPartners.name })
      .from(labPartners)
      .where(eq(labPartners.active, true))
      .orderBy(asc(labPartners.name)),
  ])
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }))
  const partnerName = new Map(partners.map((p) => [p.id, p.name]))
  const groups = [
    ...categories.map((c) => ({ category: c, items: testRows.filter((t) => t.categoryId === c.id) })),
    { category: null, items: testRows.filter((t) => !t.categoryId) },
  ].filter((g) => g.category || g.items.length > 0)

  return (
    <>
      <PageHeader title="Test Categories" description="Organise the test catalogue and set prices." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {groups.map(({ category, items }) => (
            <Panel
              key={category?.id ?? 'none'}
              title={category?.name ?? 'Uncategorised'}
              description={category?.description ?? undefined}
              actions={
                category && (
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <EditToggle label={`Edit ${category.name}`}>
                      <CategoryForm category={category} />
                    </EditToggle>
                    <DeleteButton
                      action={deleteCategory}
                      id={category.id}
                      label={`Delete ${category.name}`}
                      confirmText={`Delete category "${category.name}"? Its tests become uncategorised.`}
                    />
                  </div>
                )
              }
            >
              {items.length === 0 ? (
                <EmptyState>No tests in this category yet.</EmptyState>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {items.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.code}
                          {t.sampleType && ` · ${t.sampleType}`} · {t.turnaroundHours}h
                          {t.partnerId && ` · Outsourced to ${partnerName.get(t.partnerId) ?? 'partner'}`}
                        </span>
                      </div>
                      <span className="font-medium tabular-nums">{formatLKR(t.price)}</span>
                      <EditToggle label={`Edit ${t.name}`}>
                        <TestForm test={t} categories={categoryOptions} partners={partners} />
                      </EditToggle>
                      <DeleteButton
                        action={deleteTest}
                        id={t.id}
                        label={`Remove ${t.name}`}
                        confirmText={`Remove "${t.name}" from the catalogue?`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-36 lg:self-start">
          <Panel title="Add test">
            <TestForm categories={categoryOptions} partners={partners} />
          </Panel>
          <Panel title="Add category">
            <CategoryForm />
          </Panel>
        </div>
      </div>
    </>
  )
}
