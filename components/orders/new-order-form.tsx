'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { createOrder, searchPatients } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Panel, selectClass } from '@/components/lab/page-parts'
import { formatLKR } from '@/lib/format'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { PatientQuickForm } from './patient-quick-form'

type Test = {
  id: number
  code: string
  name: string
  price: number
  categoryId: number | null
  sampleType: string | null
  partnerId: number | null
}
type PatientHit = { id: number; patientCode: string; fullName: string; phone: string | null }

export function NewOrderForm({
  tests,
  categories,
  templates,
  doctors,
}: {
  tests: Test[]
  categories: { id: number; name: string }[]
  templates: { id: number; name: string; testIds: number[] }[]
  doctors: { id: number; name: string; hospital: string | null }[]
}) {
  const [patient, setPatient] = useState<PatientHit | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PatientHit[]>([])
  const [searching, startSearch] = useTransition()
  const searchRequestId = useRef(0)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [duplicatePatientMessage, setDuplicatePatientMessage] = useState('')

  const [selected, setSelected] = useState<number[]>([])
  const [testQuery, setTestQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [doctorId, setDoctorId] = useState('')
  const [discount, setDiscount] = useState('0')
  const [payment, setPayment] = useState('0')
  const [method, setMethod] = useState<string>('cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({})
  const [submitting, startSubmit] = useTransition()

  const testById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests])
  const visibleTests = useMemo(() => {
    const q = testQuery.trim().toLowerCase()
    return tests.filter(
      (t) =>
        (category === 'all' || String(t.categoryId) === category) &&
        (!q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)),
    )
  }, [tests, testQuery, category])

  const subtotal = selected.reduce((sum, id) => sum + (testById.get(id)?.price ?? 0), 0)
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const total = subtotal - discountValue

  useEffect(() => {
    const requestId = searchRequestId.current
    const value = query.trim()
    if (value.length < 2) {
      setHits([])
      return
    }

    const timeout = window.setTimeout(() => {
      startSearch(async () => {
        const results = await searchPatients(value)
        if (requestId === searchRequestId.current) setHits(results)
      })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [query, startSearch])

  function toggleTest(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setFieldErrors((current) => ({ ...current, testIds: undefined, partnerId: undefined }))
  }

  function updatePatientQuery(value: string) {
    if (value !== query) {
      searchRequestId.current += 1
      setHits([])
      setDuplicatePatientMessage('')
      setFieldErrors((current) => ({ ...current, patientId: undefined }))
    }
    setQuery(value)
  }

  function applyTemplate(testIds: number[]) {
    setSelected((prev) => [...new Set([...prev, ...testIds.filter((id) => testById.has(id))])])
    setFieldErrors((current) => ({ ...current, testIds: undefined, partnerId: undefined }))
  }

  function submit() {
    setError(null)
    setFieldErrors({})
    if (!patient) {
      setFieldErrors({ patientId: 'Select or register a patient first.' })
      return
    }
    if (selected.length === 0) {
      setFieldErrors({ testIds: 'Choose at least one test.' })
      return
    }
    startSubmit(async () => {
      const result = await createOrder({
        patientId: patient.id,
        doctorId: doctorId ? Number(doctorId) : null,
        testIds: selected,
        discount: discount.trim() ? Number(discount) : 0,
        paymentAmount: payment.trim() ? Number(payment) : 0,
        paymentMethod: method,
        notes,
      })
      if (result?.fieldErrors) setFieldErrors(result.fieldErrors)
      if (result?.error && (!result.fieldErrors || result.fieldErrors.branchId)) setError(result.error)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          title="1. Patient"
          actions={
            !patient && (
              <Button variant="outline" size="sm" onClick={() => setShowNewPatient((v) => !v)}>
                {showNewPatient ? 'Search existing' : 'Register new patient'}
              </Button>
            )
          }
        >
          {patient ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3">
              <div className="flex flex-col">
                <span className="font-medium text-accent-foreground">{patient.fullName}</span>
                <span className="text-sm text-muted-foreground">
                  {patient.patientCode} {patient.phone && `· ${patient.phone}`}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>
                <X aria-hidden /> Change
              </Button>
            </div>
          ) : showNewPatient ? (
            <PatientQuickForm
              onCreated={(p) => {
                setPatient(p)
                setShowNewPatient(false)
                setFieldErrors((current) => ({ ...current, patientId: undefined }))
              }}
              onDuplicate={(search) => {
                updatePatientQuery(search)
                setShowNewPatient(false)
                setDuplicatePatientMessage('This patient is already registered. Select the matching patient from the search results.')
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {duplicatePatientMessage && (
                <p className="text-sm text-muted-foreground" role="status">{duplicatePatientMessage}</p>
              )}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => updatePatientQuery(e.target.value)}
                  placeholder="Search by name, phone, NIC or patient ID"
                  aria-label="Search patients"
                  className="h-10 pl-8"
                />
                {searching && (
                  <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {hits.length > 0 && (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPatient(h)
                          setDuplicatePatientMessage('')
                          setFieldErrors((current) => ({ ...current, patientId: undefined }))
                        }}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        <span className="font-medium">{h.fullName}</span>
                        <span className="text-muted-foreground">
                          {h.patientCode} {h.phone && `· ${h.phone}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && !searching && hits.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No patients found.{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => setShowNewPatient(true)}
                  >
                    Register a new patient
                  </button>
                </p>
              )}
            </div>
          )}
          {fieldErrors.patientId && (
            <p className="text-sm text-destructive" role="alert">{fieldErrors.patientId}</p>
          )}
        </Panel>

        <Panel title="2. Tests" description="Select tests or add a template package.">
          {templates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <Button key={t.id} variant="secondary" size="sm" onClick={() => applyTemplate(t.testIds)}>
                  + {t.name}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="search"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Search tests by name or code"
              aria-label="Search tests"
              className="h-9"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className={cn(selectClass, 'h-9 sm:w-56')}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
            {visibleTests.map((t) => {
              const checked = selected.includes(t.id)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleTest(t.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      checked ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.code}
                        {t.sampleType && ` · ${t.sampleType}`}
                        {t.partnerId && ' · Outsourced'}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">{formatLKR(t.price)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {fieldErrors.testIds && <p className="text-sm text-destructive" role="alert">{fieldErrors.testIds}</p>}
          {fieldErrors.partnerId && <p className="text-sm text-destructive" role="alert">{fieldErrors.partnerId}</p>}
        </Panel>
      </div>

      <div className="lg:sticky lg:top-36 lg:self-start">
        <Panel title="3. Summary & Payment">
          <Field label="Referring doctor" htmlFor="doctor">
            <select
              id="doctor"
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value)
                setFieldErrors((current) => ({ ...current, doctorId: undefined }))
              }}
              className={selectClass}
            >
              <option value="">Self / walk-in</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.hospital ? ` — ${d.hospital}` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.doctorId && <p className="text-sm text-destructive" role="alert">{fieldErrors.doctorId}</p>}
          </Field>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Selected tests ({selected.length})</p>
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tests selected yet.</p>
            ) : (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                {selected.map((id) => {
                  const t = testById.get(id)
                  if (!t) return null
                  return (
                    <li key={id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{t.name}</span>
                      <span className="flex items-center gap-1">
                        <span className="tabular-nums">{formatLKR(t.price)}</span>
                        <button
                          type="button"
                          onClick={() => toggleTest(id)}
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${t.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatLKR(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label htmlFor="discount" className="text-muted-foreground">
                  Discount (LKR)
                </label>
              </dt>
              <dd>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => {
                    setDiscount(e.target.value)
                    setFieldErrors((current) => ({ ...current, discount: undefined }))
                  }}
                  className="w-28 text-right"
                />
                {fieldErrors.discount && <p className="text-sm text-destructive" role="alert">{fieldErrors.discount}</p>}
              </dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatLKR(total)}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Paid now (LKR)" htmlFor="payment">
              <Input
                id="payment"
                type="number"
                min={0}
                step="0.01"
                value={payment}
                onChange={(e) => {
                  setPayment(e.target.value)
                  setFieldErrors((current) => ({ ...current, paymentAmount: undefined }))
                }}
              />
              {fieldErrors.paymentAmount && (
                <p className="text-sm text-destructive" role="alert">{fieldErrors.paymentAmount}</p>
              )}
            </Field>
            <Field label="Method" htmlFor="method">
              <select
                id="method"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value)
                  setFieldErrors((current) => ({ ...current, paymentMethod: undefined }))
                }}
                className={selectClass}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
              {fieldErrors.paymentMethod && (
                <p className="text-sm text-destructive" role="alert">{fieldErrors.paymentMethod}</p>
              )}
            </Field>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPayment(total.toFixed(2))}>
            Mark as fully paid
          </Button>

          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {fieldErrors.branchId && (
            <p className="text-sm text-destructive" role="alert">{fieldErrors.branchId}</p>
          )}
          <Button onClick={submit} disabled={submitting} className="h-10">
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Create order
          </Button>
        </Panel>
      </div>
    </div>
  )
}
