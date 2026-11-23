'use client'

import { Fragment, useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Search, Trash2 } from 'lucide-react'
import {
  deleteReportTemplate,
  saveReportTemplate,
  setSystemReportTemplateVisibility,
  type ReportTemplateState,
} from '@/app/actions/catalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, PageHeader, Panel, selectClass } from '@/components/lab/page-parts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ReportTemplateConfiguration, ReportTemplateParameter } from '@/lib/db/schema'
import { formatLKR } from '@/lib/format'

type ReportTemplateRowData = {
  id: number
  code: string
  name: string
  aliases: string[]
  sampleType: string | null
  price: string
  categoryName: string | null
  partnerId: number | null
  partnerName: string | null
  active: boolean
  customConfiguration: ReportTemplateConfiguration | null
  defaultConfiguration: ReportTemplateConfiguration | null
  defaultHidden: boolean
}

const EMPTY_CONFIGURATION: ReportTemplateConfiguration = {
  parameters: [{ name: '', unit: '', referenceInterval: '' }],
  columns: ['parameter', 'result', 'unit', 'referenceInterval'],
}

const REPORT_COLUMNS = [
  { value: 'parameter', label: 'Parameter' },
  { value: 'result', label: 'Result' },
  { value: 'unit', label: 'Unit' },
  { value: 'referenceInterval', label: 'Reference interval' },
] as const

export function ReportTemplateManager({ rows }: { rows: ReportTemplateRowData[] }) {
  const [query, setQuery] = useState('')
  const [editingTestId, setEditingTestId] = useState<number | null>(null)
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const router = useRouter()
  const closeEditor = useCallback(() => setEditingTestId(null), [])
  const term = query.trim().toLowerCase()

  const groups = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (!term) return true
      const searchable = [
        row.code,
        row.name,
        row.sampleType ?? '',
        row.categoryName ?? '',
        ...row.aliases,
      ]
      return searchable.some((value) => value.toLowerCase().includes(term))
    })
    const grouped = new Map<string, ReportTemplateRowData[]>()
    for (const row of filtered) {
      const category = row.categoryName ?? 'Uncategorised'
      const categoryRows = grouped.get(category) ?? []
      categoryRows.push(row)
      grouped.set(category, categoryRows)
    }
    return [...grouped].map(([category, categoryRows]) => ({ category, rows: categoryRows }))
  }, [rows, term])

  const hasDefaults = rows.some((row) => row.defaultConfiguration !== null)
  const availableTests = rows.filter((row) =>
    row.customConfiguration === null && row.defaultConfiguration === null,
  )

  return (
    <>
      <PageHeader
        title="Report Templates"
        description="Configure which columns and parameters appear on each test’s report."
        actions={
          <Button type="button" onClick={() => setNewTemplateOpen(true)}>
            <Plus aria-hidden />
            New Template
          </Button>
        }
      />
      <nav aria-label="Template sections" className="flex w-fit gap-1 rounded-lg border border-border bg-muted/40 p-1">
        <Link
          href="/templates"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Order Packages
        </Link>
        <Link
          href="/templates?tab=reports"
          aria-current="page"
          className="rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
        >
          Report Templates
        </Link>
      </nav>
      <Panel>
        {!hasDefaults && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground" role="status">
            No lab-approved system defaults are configured. Tests without a custom template are shown as Unconfigured.
          </p>
        )}
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates by name, short name, sample or category ..."
            aria-label="Search report templates"
            className="pl-8"
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState>No tests are available to configure.</EmptyState>
        ) : groups.length === 0 ? (
          <EmptyState>No tests match this search.</EmptyState>
        ) : (
          <Table className="min-w-[1080px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead className="w-[30%] min-w-[300px]">Test Name</TableHead>
                <TableHead className="w-32">Sample</TableHead>
                <TableHead className="w-32 text-right">Price</TableHead>
                <TableHead className="w-24 text-right">Margin</TableHead>
                <TableHead className="w-36">Outsource</TableHead>
                <TableHead className="w-32">Active</TableHead>
                <TableHead className="w-52">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.category}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={8} className="font-semibold">{group.category}</TableCell>
                  </TableRow>
                  {group.rows.map((row) => {
                    const hasDefault = row.defaultConfiguration !== null
                    const hasCustom = row.customConfiguration !== null
                    const usingDefault = hasDefault && !hasCustom && !row.defaultHidden
                    const state = !row.active
                      ? 'Inactive'
                      : hasCustom || usingDefault
                        ? 'Active'
                        : hasDefault
                          ? 'Hidden'
                          : 'Unconfigured'
                    const seed = row.customConfiguration ?? row.defaultConfiguration ?? EMPTY_CONFIGURATION

                    return (
                      <Fragment key={row.id}>
                        <TableRow>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {row.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[300px] whitespace-normal">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{row.name}</span>
                              {usingDefault && <Badge variant="secondary" className="w-fit">System default</Badge>}
                              {hasCustom && <Badge variant="outline" className="w-fit">Custom</Badge>}
                              {!hasDefault && !hasCustom && <Badge variant="ghost" className="w-fit">Unconfigured</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{row.sampleType || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatLKR(row.price)}</TableCell>
                          <TableCell className="text-right tabular-nums">—</TableCell>
                          <TableCell>{row.partnerName ?? (row.partnerId ? 'Outsourced' : 'In-house')}</TableCell>
                          <TableCell>
                            <Badge variant={state === 'Active' ? 'secondary' : 'outline'}>{state}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-44 flex-wrap items-center gap-1">
                              {hasCustom ? (
                                <>
                                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingTestId(row.id)}>
                                    Edit
                                  </Button>
                                  <DeleteReportTemplateButton
                                    testId={row.id}
                                    testName={row.name}
                                    onDeleted={closeEditor}
                                  />
                                </>
                              ) : usingDefault ? (
                                <>
                                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingTestId(row.id)}>
                                    Customise
                                  </Button>
                                  <SystemTemplateVisibilityButton testId={row.id} hidden={false} />
                                </>
                              ) : hasDefault ? (
                                <SystemTemplateVisibilityButton testId={row.id} hidden />
                              ) : (
                                <Button type="button" variant="outline" size="sm" onClick={() => setEditingTestId(row.id)}>
                                  Configure
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {editingTestId === row.id && (
                          <TableRow>
                            <TableCell colSpan={8} className="whitespace-normal">
                              <ReportTemplateEditor
                                key={`${row.id}-${hasCustom ? 'custom' : 'new'}`}
                                testId={row.id}
                                testName={row.name}
                                initialConfiguration={seed}
                                isCustom={hasCustom}
                                onClose={closeEditor}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New report template</DialogTitle>
            <DialogDescription>
              Choose a test and configure the parameters and columns for its report.
            </DialogDescription>
          </DialogHeader>
          {newTemplateOpen && availableTests.length > 0 ? (
            <ReportTemplateEditor
              key="new-report-template"
              testId={null}
              testName=""
              testOptions={availableTests.map(({ id, code, name }) => ({ id, code, name }))}
              createOnly
              initialConfiguration={EMPTY_CONFIGURATION}
              isCustom={false}
              onClose={() => setNewTemplateOpen(false)}
            />
          ) : (
            <EmptyState>Every test already has a custom template or an approved system default.</EmptyState>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReportTemplateEditor({
  testId,
  testName,
  testOptions,
  createOnly = false,
  initialConfiguration,
  isCustom,
  onClose,
}: {
  testId: number | null
  testName: string
  testOptions?: { id: number; code: string; name: string }[]
  createOnly?: boolean
  initialConfiguration: ReportTemplateConfiguration
  isCustom: boolean
  onClose: () => void
}) {
  const [state, formAction, pending] = useActionState(saveReportTemplate, undefined)
  const [selectedTestId, setSelectedTestId] = useState<number | ''>(() =>
    testId ?? testOptions?.[0]?.id ?? '',
  )
  const [parameters, setParameters] = useState<ReportTemplateParameter[]>(() =>
    initialConfiguration.parameters.length > 0
      ? initialConfiguration.parameters.map((parameter) => ({ ...parameter }))
      : [{ name: '', unit: '', referenceInterval: '' }],
  )
  const [columns, setColumns] = useState<string[]>(initialConfiguration.columns)
  const router = useRouter()
  const handledNonce = useRef<number | null>(null)
  const selectedTestName =
    testId === null
      ? testOptions?.find((test) => test.id === selectedTestId)?.name ?? ''
      : testName

  useEffect(() => {
    if (!state?.success || handledNonce.current === state.nonce) return
    handledNonce.current = state.nonce ?? null
    router.refresh()
    onClose()
  }, [state?.nonce, state?.success, router, onClose])

  function updateParameter(index: number, key: keyof ReportTemplateParameter, value: string) {
    setParameters((current) => current.map((parameter, currentIndex) =>
      currentIndex === index ? { ...parameter, [key]: value } : parameter,
    ))
  }

  function toggleColumn(value: string) {
    setColumns((current) => current.includes(value)
      ? current.filter((column) => column !== value)
      : [...current, value],
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
      {testId === null ? (
        <>
          {createOnly && <input type="hidden" name="createOnly" value="true" />}
          <label className="flex max-w-xl flex-col gap-1.5 text-sm font-medium">
            Test
            <select
              name="testId"
              required
              value={selectedTestId}
              onChange={(event) => setSelectedTestId(event.target.value ? Number(event.target.value) : '')}
              className={selectClass}
            >
              <option value="" disabled>Choose a test</option>
              {testOptions?.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name} ({test.code})
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <input type="hidden" name="testId" value={testId} />
      )}
      <div>
        <h3 className="font-semibold">
          {isCustom ? 'Edit custom report template' : 'Configure report template'}
          {selectedTestName && ` · ${selectedTestName}`}
        </h3>
        {!isCustom && initialConfiguration.parameters.some((parameter) => parameter.name) && (
          <p className="mt-1 text-sm text-muted-foreground">
            Built-in values are prefilled. Saving creates a custom copy without changing the system default.
          </p>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Result parameters</legend>
        {parameters.map((parameter, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_0.7fr_1fr_auto]">
            <Input
              name="parameterName"
              value={parameter.name}
              onChange={(event) => updateParameter(index, 'name', event.target.value)}
              placeholder="Parameter name"
              aria-label={`Parameter ${index + 1} name`}
            />
            <Input
              name="parameterUnit"
              value={parameter.unit}
              onChange={(event) => updateParameter(index, 'unit', event.target.value)}
              placeholder="Unit"
              aria-label={`Parameter ${index + 1} unit`}
            />
            <Input
              name="referenceInterval"
              value={parameter.referenceInterval}
              onChange={(event) => updateParameter(index, 'referenceInterval', event.target.value)}
              placeholder="Reference interval"
              aria-label={`Parameter ${index + 1} reference interval`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove parameter ${index + 1}`}
              onClick={() => setParameters((current) => current.filter((_, currentIndex) => currentIndex !== index))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={parameters.length >= 100}
          onClick={() => setParameters((current) => [...current, { name: '', unit: '', referenceInterval: '' }])}
        >
          <Plus aria-hidden />
          Add parameter
        </Button>
      </fieldset>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 w-full text-sm font-medium">Report columns</legend>
        {REPORT_COLUMNS.map((column) => (
          <label key={column.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="columns"
              value={column.value}
              checked={columns.includes(column.value)}
              onChange={() => toggleColumn(column.value)}
              className="size-4 accent-[var(--primary)]"
            />
            {column.label}
          </label>
        ))}
      </fieldset>
      {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {isCustom ? 'Save changes' : 'Save as custom template'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  )
}

function SystemTemplateVisibilityButton({ testId, hidden }: { testId: number; hidden: boolean }) {
  const [state, formAction, pending] = useActionState(setSystemReportTemplateVisibility, undefined)
  const router = useRouter()
  const handledNonce = useRef<number | null>(null)

  useEffect(() => {
    if (!state?.success || handledNonce.current === state.nonce) return
    handledNonce.current = state.nonce ?? null
    router.refresh()
  }, [state?.nonce, state?.success, router])

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="testId" value={testId} />
        <input type="hidden" name="hidden" value={String(!hidden)} />
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {hidden ? 'Show' : 'Hide'}
        </Button>
      </form>
      {state?.error && <p className="max-w-48 text-xs text-destructive" role="alert">{state.error}</p>}
    </div>
  )
}

function DeleteReportTemplateButton({
  testId,
  testName,
  onDeleted,
}: {
  testId: number
  testName: string
  onDeleted: () => void
}) {
  const [state, formAction, pending] = useActionState(deleteReportTemplate, undefined)
  const router = useRouter()
  const handledNonce = useRef<number | null>(null)

  useEffect(() => {
    if (!state?.success || handledNonce.current === state.nonce) return
    handledNonce.current = state.nonce ?? null
    router.refresh()
    onDeleted()
  }, [state?.nonce, state?.success, router, onDeleted])

  return (
    <div className="flex flex-col items-start gap-1">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Delete the custom report template for "${testName}"? The test, orders, results, and completed reports will be retained.`)) {
            event.preventDefault()
          }
        }}
      >
        <input type="hidden" name="testId" value={testId} />
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
          Delete
        </Button>
      </form>
      {state?.error && <p className="max-w-48 text-xs text-destructive" role="alert">{state.error}</p>}
    </div>
  )
}
