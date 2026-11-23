import { asc } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { branches } from '@/lib/db/schema'
import { requirePermission } from '@/lib/staff'
import { EmptyState, PageHeader, Panel } from '@/components/lab/page-parts'
import { EditToggle } from '@/components/lab/crud-form'
import { BranchDeleteButton, BranchForm } from '@/components/branches/branch-form'

export const metadata: Metadata = { title: 'Branches' }

export default async function BranchesPage() {
  await requirePermission('branches.manage')
  const rows = await db.select().from(branches).orderBy(asc(branches.name))

  return (
    <>
      <PageHeader title="Branches" description="Manage the locations used for staff access and records." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title={`Branches (${rows.length})`}>
          {rows.length === 0 ? (
            <EmptyState>No branches yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((branch) => (
                <li key={branch.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{branch.name}</span>
                    <span className="text-xs text-muted-foreground">{branch.code}</span>
                  </div>
                  <EditToggle label={`Edit ${branch.name}`}>
                    <BranchForm branch={branch} />
                  </EditToggle>
                  <BranchDeleteButton id={branch.id} name={branch.name} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Add branch" className="lg:sticky lg:top-36 lg:self-start">
          <BranchForm />
        </Panel>
      </div>
    </>
  )
}
