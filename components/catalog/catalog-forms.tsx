'use client'

import { useEffect, useState, useTransition } from 'react'
import { restoreTest, saveCategory, saveDoctor, savePartner, saveTemplate, saveTest } from '@/app/actions/catalog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CrudForm, type CrudFormContext } from '@/components/lab/crud-form'
import { Field, selectClass } from '@/components/lab/page-parts'
import { formatLKR } from '@/lib/format'
import type { CrudState } from '@/app/actions/catalog'
import { validateOptionalEmail, validateOptionalPhone } from '@/lib/form-validation'
import { cn } from '@/lib/utils'

type Option = { id: number; name: string }

function useUid(prefix: string, id?: number) {
  return (key: string) => `${prefix}-${id ?? 'new'}-${key}`
}

export function CategoryForm({
  category,
  onSuccess,
}: {
  category?: { id: number; name: string; description: string | null }
  onSuccess?: () => void
}) {
  const uid = useUid('cat', category?.id)
  return (
    <CrudForm action={saveCategory} submitLabel={category ? 'Save' : 'Add category'} resetOnSuccess={!category} onSuccess={onSuccess}>
      {category && <input type="hidden" name="id" value={category.id} />}
      <Field label="Name" htmlFor={uid('name')}>
        <Input id={uid('name')} name="name" required defaultValue={category?.name} />
      </Field>
      <Field label="Description" htmlFor={uid('desc')}>
        <Input id={uid('desc')} name="description" defaultValue={category?.description ?? ''} />
      </Field>
    </CrudForm>
  )
}

export function TestForm({
  test,
  categories,
  partners,
  onSuccess,
}: {
  test?: {
    id: number
    name: string
    code: string
    price: string
    sampleType: string | null
    aliases?: string[] | null
    turnaroundHours: number
    categoryId: number | null
    partnerId: number | null
  }
  categories: Option[]
  partners: Option[]
  onSuccess?: () => void
}) {
  const uid = useUid('test', test?.id)
  const [formKey, setFormKey] = useState(0)
  const [restoreNotice, setRestoreNotice] = useState('')
  return (
    <CrudForm
      key={formKey}
      action={saveTest}
      submitLabel={test ? 'Save' : 'Add test'}
      resetOnSuccess={!test}
      onSuccess={onSuccess}
      feedback={(state) => {
        const archivedConflicts = state?.testConflicts?.filter((conflict) => !conflict.active) ?? []
        return (
          <>
            {state?.nameError && <FieldError id={uid('name-error')}>{`Name conflict: ${state.nameError}`}</FieldError>}
            {state?.codeError && <FieldError id={uid('code-error')}>{`Code conflict: ${state.codeError}`}</FieldError>}
            {archivedConflicts.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm" role="status">
                  A matching test is archived. Restore it instead of adding a new record.
                </p>
                {archivedConflicts.map((conflict) => (
                  <RestoreTestButton
                    key={conflict.id}
                    conflict={conflict}
                    onRestored={(message) => {
                      setRestoreNotice(message)
                      setFormKey((key) => key + 1)
                    }}
                  />
                ))}
              </div>
            )}
            {restoreNotice && (
              <p className="text-sm text-success" role="status">
                {restoreNotice}
              </p>
            )}
          </>
        )
      }}
    >
      {test && <input type="hidden" name="id" value={test.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Test name" htmlFor={uid('name')} className="sm:col-span-2">
          <Input
            id={uid('name')}
            name="name"
            required
            defaultValue={test?.name}
            aria-describedby={uid('name-error')}
          />
        </Field>
        <Field label="Code" htmlFor={uid('code')}>
          <Input id={uid('code')} name="code" required defaultValue={test?.code} aria-describedby={uid('code-error')} />
        </Field>
        <Field label="Price (LKR)" htmlFor={uid('price')}>
          <Input id={uid('price')} name="price" type="number" min={0} step="0.01" required defaultValue={test?.price} />
        </Field>
        <Field label="Sample type" htmlFor={uid('sample')}>
          <Input id={uid('sample')} name="sampleType" placeholder="Blood, Urine…" defaultValue={test?.sampleType ?? ''} />
        </Field>
        <Field label="Short names / aliases" htmlFor={uid('aliases')}>
          <Input
            id={uid('aliases')}
            name="aliases"
            placeholder="Comma-separated"
            defaultValue={test?.aliases?.join(', ') ?? ''}
          />
        </Field>
        <Field label="Turnaround (hours)" htmlFor={uid('tat')}>
          <Input id={uid('tat')} name="turnaroundHours" type="number" min={1} defaultValue={test?.turnaroundHours ?? 24} />
        </Field>
        <Field label="Category" htmlFor={uid('cat')}>
          <select id={uid('cat')} name="categoryId" defaultValue={test?.categoryId ?? ''} className={selectClass}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Outsource to" htmlFor={uid('partner')}>
          <select id={uid('partner')} name="partnerId" defaultValue={test?.partnerId ?? ''} className={selectClass}>
            <option value="">In-house</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </CrudForm>
  )
}

function RestoreTestButton({
  conflict,
  onRestored,
}: {
  conflict: { id: number; name: string; code: string; fields: string[] }
  onRestored: (message: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean }>()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          const fd = new FormData()
          fd.set('id', String(conflict.id))
          startTransition(async () => {
            const result = await restoreTest(fd)
            if (result?.success) onRestored(result.success)
            else setMessage({ text: result?.error ?? 'Restore failed.', error: true })
          })
        }}
      >
        {pending ? 'Restoring…' : `Restore ${conflict.name}`}
      </Button>
      <span className="text-xs text-muted-foreground">
        {conflict.code} · matches {conflict.fields.join(' and ')}
      </span>
      {message && (
        <span className="text-sm" role={message.error ? 'alert' : 'status'}>
          {message.text}
        </span>
      )}
    </div>
  )
}

export function DoctorForm({
  doctor,
  onSuccess,
}: {
  doctor?: { id: number; name: string; specialty: string | null; hospital: string | null; phone: string | null; email: string | null }
  onSuccess?: () => void
}) {
  const uid = useUid('doc', doctor?.id)
  return (
    <CrudForm action={saveDoctor} submitLabel={doctor ? 'Save' : 'Add doctor'} resetOnSuccess={!doctor} onSuccess={onSuccess}>
      {(context) => <DoctorFields {...context} doctor={doctor} uid={uid} />}
    </CrudForm>
  )
}

function DoctorFields({
  state,
  values,
  setValue,
  doctor,
  uid,
}: CrudFormContext & {
  doctor?: { id: number; name: string; specialty: string | null; hospital: string | null; phone: string | null; email: string | null }
  uid: (key: string) => string
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  useEffect(() => setTouched({}), [state?.nonce])

  const name = values.name ?? doctor?.name ?? ''
  const phone = values.phone ?? doctor?.phone ?? ''
  const email = values.email ?? doctor?.email ?? ''
  const nameError = touched.name
    ? name.trim() ? undefined : 'Doctor name is required.'
    : state?.nameError
  const phoneError = touched.phone ? validateOptionalPhone(phone) : state?.phoneError
  const emailError = touched.email ? validateOptionalEmail(email) : state?.emailError
  const update = (key: string, value: string) => {
    setValue(key, value)
    setTouched((current) => ({ ...current, [key]: true }))
  }

  return (
    <>
      {doctor && <input type="hidden" name="id" value={doctor.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={uid('name')} className="sm:col-span-2">
          <Input
            id={uid('name')}
            name="name"
            required
            placeholder="Dr. "
            value={name}
            onChange={(event) => update('name', event.target.value)}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? uid('name-error') : undefined}
          />
          {nameError && <FieldError id={uid('name-error')}>{nameError}</FieldError>}
        </Field>
        <Field label="Specialty" htmlFor={uid('spec')}>
          <Input
            id={uid('spec')}
            name="specialty"
            value={values.specialty ?? doctor?.specialty ?? ''}
            onChange={(event) => setValue('specialty', event.target.value)}
          />
        </Field>
        <Field label="Hospital / clinic" htmlFor={uid('hosp')}>
          <Input
            id={uid('hosp')}
            name="hospital"
            value={values.hospital ?? doctor?.hospital ?? ''}
            onChange={(event) => setValue('hospital', event.target.value)}
          />
        </Field>
        <Field label="Phone" htmlFor={uid('phone')}>
          <Input
            id={uid('phone')}
            name="phone"
            type="tel"
            value={phone}
            onChange={(event) => update('phone', event.target.value)}
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? uid('phone-error') : undefined}
          />
          {phoneError && <FieldError id={uid('phone-error')}>{phoneError}</FieldError>}
        </Field>
        <Field label="Email" htmlFor={uid('email')}>
          <Input
            id={uid('email')}
            name="email"
            type="email"
            value={email}
            onChange={(event) => update('email', event.target.value)}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? uid('email-error') : undefined}
          />
          {emailError && <FieldError id={uid('email-error')}>{emailError}</FieldError>}
        </Field>
      </div>
    </>
  )
}

export function PartnerForm({
  partner,
  onSuccess,
}: {
  partner?: {
    id: number
    name: string
    contactPerson: string | null
    phone: string | null
    email: string | null
    address: string | null
  }
  onSuccess?: () => void
}) {
  const uid = useUid('partner', partner?.id)
  return (
    <CrudForm action={savePartner} submitLabel={partner ? 'Save' : 'Add partner'} resetOnSuccess={!partner} onSuccess={onSuccess}>
      {(context) => <PartnerFields {...context} partner={partner} uid={uid} />}
    </CrudForm>
  )
}

function PartnerFields({
  state,
  values,
  setValue,
  partner,
  uid,
}: CrudFormContext & {
  partner?: { id: number; name: string; contactPerson: string | null; phone: string | null; email: string | null; address: string | null }
  uid: (key: string) => string
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  useEffect(() => setTouched({}), [state?.nonce])

  const name = values.name ?? partner?.name ?? ''
  const phone = values.phone ?? partner?.phone ?? ''
  const email = values.email ?? partner?.email ?? ''
  const nameError = touched.name
    ? name.trim() ? undefined : 'Laboratory name is required.'
    : state?.nameError
  const phoneError = touched.phone ? validateOptionalPhone(phone) : state?.phoneError
  const emailError = touched.email ? validateOptionalEmail(email) : state?.emailError
  const update = (key: string, value: string) => {
    setValue(key, value)
    setTouched((current) => ({ ...current, [key]: true }))
  }

  return (
    <>
      {partner && <input type="hidden" name="id" value={partner.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Laboratory name" htmlFor={uid('name')} className="sm:col-span-2">
          <Input
            id={uid('name')}
            name="name"
            required
            value={name}
            onChange={(event) => update('name', event.target.value)}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? uid('name-error') : undefined}
          />
          {nameError && <FieldError id={uid('name-error')}>{nameError}</FieldError>}
        </Field>
        <Field label="Contact person" htmlFor={uid('contact')}>
          <Input
            id={uid('contact')}
            name="contactPerson"
            value={values.contactPerson ?? partner?.contactPerson ?? ''}
            onChange={(event) => setValue('contactPerson', event.target.value)}
          />
        </Field>
        <Field label="Phone" htmlFor={uid('phone')}>
          <Input
            id={uid('phone')}
            name="phone"
            type="tel"
            value={phone}
            onChange={(event) => update('phone', event.target.value)}
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? uid('phone-error') : undefined}
          />
          {phoneError && <FieldError id={uid('phone-error')}>{phoneError}</FieldError>}
        </Field>
        <Field label="Email" htmlFor={uid('email')}>
          <Input
            id={uid('email')}
            name="email"
            type="email"
            value={email}
            onChange={(event) => update('email', event.target.value)}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? uid('email-error') : undefined}
          />
          {emailError && <FieldError id={uid('email-error')}>{emailError}</FieldError>}
        </Field>
        <Field label="Address" htmlFor={uid('address')}>
          <Input
            id={uid('address')}
            name="address"
            value={values.address ?? partner?.address ?? ''}
            onChange={(event) => setValue('address', event.target.value)}
          />
        </Field>
      </div>
    </>
  )
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {children}
    </p>
  )
}

export function TemplateForm({
  template,
  tests,
  onSuccess,
}: {
  template?: { id: number; name: string; description: string | null; testIds: number[] }
  tests: { id: number; name: string; code: string; price: number }[]
  onSuccess?: () => void
}) {
  const uid = useUid('tpl', template?.id)
  const [selected, setSelected] = useState<number[]>(template?.testIds ?? [])
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = tests.filter((t) => !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q))
  const total = tests.filter((t) => selected.includes(t.id)).reduce((s, t) => s + t.price, 0)

  return (
    <CrudForm
      action={saveTemplate}
      submitLabel={template ? 'Save' : 'Create package'}
      resetOnSuccess={!template}
      onSuccess={() => {
        if (!template) setSelected([])
        onSuccess?.()
      }}
    >
      {template && <input type="hidden" name="id" value={template.id} />}
      {selected.map((id) => (
        <input key={id} type="hidden" name="testIds" value={id} />
      ))}
      <Field label="Package name" htmlFor={uid('name')}>
        <Input
          id={uid('name')}
          name="name"
          required
          placeholder="e.g. Full Body Checkup"
          defaultValue={template?.name}
          className="h-10 rounded-xl"
        />
      </Field>
      <Field label="Description" htmlFor={uid('desc')}>
        <Input
          id={uid('desc')}
          name="description"
          placeholder="Optional details about this package"
          defaultValue={template?.description ?? ''}
          className="h-10 rounded-xl"
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          Tests ({selected.length}) · {formatLKR(total)}
        </legend>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tests by name or code"
          aria-label="Filter tests"
          className="h-10 rounded-xl"
        />
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-background p-1.5">
          {visible.map((t) => {
            const checked = selected.includes(t.id)
            return (
              <li key={t.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted',
                    checked && 'bg-accent',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelected((prev) => (checked ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                    }
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1 leading-5">{t.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatLKR(t.price)}</span>
                </label>
              </li>
            )
          })}
          {visible.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No tests match this filter.</li>
          )}
        </ul>
      </fieldset>
    </CrudForm>
  )
}
