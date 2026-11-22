import { asc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { orderTemplates, tests } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { formatLKR } from '@/lib/format'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { TemplateForm } from '@/components/catalog/catalog-forms'
import { DeleteButton, EditToggle } from '@/components/lab/crud-form'
import { deleteTemplate } from '@/app/actions/catalog'

export const metadata: Metadata = { title: 'Templates' }

export default async function TemplatesPage() {
  await requirePermission('templates')

  const [templates, testRows] = await Promise.all([
    db.select().from(orderTemplates).orderBy(asc(orderTemplates.name)),
    db
      .select({ id: tests.id, name: tests.name, code: tests.code, price: tests.price })
      .from(tests)
      .where(eq(tests.active, true))
      .orderBy(asc(tests.name)),
  ])
  const testList = testRows.map((t) => ({ ...t, price: Number(t.price) }))
  const byId = new Map(testList.map((t) => [t.id, t]))

  return (
    <>
      <PageHeader title="Templates" description="Reusable test packages for quick order entry." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {templates.length === 0 && <EmptyState>No templates yet.</EmptyState>}
          {templates.map((tpl) => {
            const items = tpl.testIds.map((id) => byId.get(id)).filter((t) => t !== undefined)
            const total = items.reduce((s, t) => s + t.price, 0)
            return (
              <Panel
                key={tpl.id}
                title={tpl.name}
                description={tpl.description ?? undefined}
                actions={
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <span className="mr-2 font-semibold tabular-nums">{formatLKR(total)}</span>
                    <EditToggle label={`Edit ${tpl.name}`}>
                      <TemplateForm template={tpl} tests={testList} />
                    </EditToggle>
                    <DeleteButton
                      action={deleteTemplate}
                      id={tpl.id}
                      label={`Delete ${tpl.name}`}
                      confirmText={`Delete template "${tpl.name}"?`}
                    />
                  </div>
                }
              >
                <ul className="flex flex-wrap gap-2">
                  {items.map((t) => (
                    <li key={t.id} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                      {t.name}
                    </li>
                  ))}
                </ul>
              </Panel>
            )
          })}
        </div>
        <Panel title="New template" className="lg:sticky lg:top-36 lg:self-start">
          <TemplateForm tests={testList} />
        </Panel>
      </div>
    </>
  )
}
