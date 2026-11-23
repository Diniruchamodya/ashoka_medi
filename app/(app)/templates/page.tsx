import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import {
  labPartners,
  orderTemplates,
  reportTemplateVisibility,
  reportTemplates,
  testCategories,
  tests,
} from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { formatLKR } from '@/lib/format'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { TemplateForm } from '@/components/catalog/catalog-forms'
import { DeleteButton, EditToggle } from '@/components/lab/crud-form'
import { deleteTemplate } from '@/app/actions/catalog'
import { ReportTemplateManager } from '@/components/catalog/report-template-manager'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/report-template-defaults'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Templates' }

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requirePermission('templates')
  const { tab } = await searchParams
  const activeTab = tab === 'reports' ? 'reports' : 'orders'

  if (activeTab === 'reports') return <ReportTemplates />

  return (
    <>
      <PageHeader title="Templates" description="Manage order packages and test report templates." />
      <nav aria-label="Template sections" className="flex w-fit gap-1 rounded-lg border border-border bg-muted/40 p-1">
        <Link
          href="/templates"
          aria-current={activeTab === 'orders' ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            activeTab === 'orders' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Order Packages
        </Link>
        <Link
          href="/templates?tab=reports"
          aria-current={undefined}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Report Templates
        </Link>
      </nav>
      <OrderPackages />
    </>
  )
}

async function OrderPackages() {
  const [templates, testRows] = await Promise.all([
    db.select().from(orderTemplates).orderBy(asc(orderTemplates.name)),
    db
      .select({ id: tests.id, name: tests.name, code: tests.code, price: tests.price })
      .from(tests)
      .where(eq(tests.active, true))
      .orderBy(asc(tests.name)),
  ])
  const testList = testRows.map((test) => ({ ...test, price: Number(test.price) }))
  const byId = new Map(testList.map((test) => [test.id, test]))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        {templates.length === 0 && <EmptyState>No templates yet.</EmptyState>}
        {templates.map((template) => {
          const items = template.testIds.map((id) => byId.get(id)).filter((test) => test !== undefined)
          const total = items.reduce((sum, test) => sum + test.price, 0)
          return (
            <Panel
              key={template.id}
              title={template.name}
              description={template.description ?? undefined}
              actions={
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <span className="mr-2 font-semibold tabular-nums">{formatLKR(total)}</span>
                  <EditToggle label={`Edit ${template.name}`}>
                    <TemplateForm template={template} tests={testList} />
                  </EditToggle>
                  <DeleteButton
                    action={deleteTemplate}
                    id={template.id}
                    label={`Delete ${template.name}`}
                    confirmText={`Delete template "${template.name}"?`}
                  />
                </div>
              }
            >
              <ul className="flex flex-wrap gap-2">
                {items.map((test) => (
                  <li key={test.id} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                    {test.name}
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
  )
}

async function ReportTemplates() {
  const [testRows, customRows, visibilityRows] = await Promise.all([
    db
      .select({
        id: tests.id,
        code: tests.code,
        name: tests.name,
        aliases: tests.aliases,
        sampleType: tests.sampleType,
        price: tests.price,
        active: tests.active,
        categoryName: testCategories.name,
        partnerId: tests.partnerId,
        partnerName: labPartners.name,
      })
      .from(tests)
      .leftJoin(testCategories, eq(testCategories.id, tests.categoryId))
      .leftJoin(labPartners, eq(labPartners.id, tests.partnerId))
      .orderBy(asc(testCategories.name), asc(tests.name)),
    db.select({ testId: reportTemplates.testId, configuration: reportTemplates.configuration }).from(reportTemplates),
    db.select({ testId: reportTemplateVisibility.testId, hidden: reportTemplateVisibility.hidden }).from(reportTemplateVisibility),
  ])
  const customByTest = new Map(customRows.map((row) => [row.testId, row.configuration]))
  const visibilityByTest = new Map(visibilityRows.map((row) => [row.testId, row.hidden]))

  return (
    <ReportTemplateManager
      rows={testRows.map((test) => ({
        ...test,
        customConfiguration: customByTest.get(test.id) ?? null,
        defaultConfiguration: SYSTEM_REPORT_TEMPLATES[test.code] ?? null,
        defaultHidden: visibilityByTest.get(test.id) ?? false,
      }))}
    />
  )
}
