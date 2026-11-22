'use client'

import { useState } from 'react'
import { saveCategory, saveDoctor, savePartner, saveTemplate, saveTest } from '@/app/actions/catalog'
import { Input } from '@/components/ui/input'
import { CrudForm } from '@/components/lab/crud-form'
import { Field, selectClass } from '@/components/lab/page-parts'
import { formatLKR } from '@/lib/format'
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
    turnaroundHours: number
    categoryId: number | null
    partnerId: number | null
  }
  categories: Option[]
  partners: Option[]
  onSuccess?: () => void
}) {
  const uid = useUid('test', test?.id)
  return (
    <CrudForm action={saveTest} submitLabel={test ? 'Save' : 'Add test'} resetOnSuccess={!test} onSuccess={onSuccess}>
      {test && <input type="hidden" name="id" value={test.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Test name" htmlFor={uid('name')} className="sm:col-span-2">
          <Input id={uid('name')} name="name" required defaultValue={test?.name} />
        </Field>
        <Field label="Code" htmlFor={uid('code')}>
          <Input id={uid('code')} name="code" required defaultValue={test?.code} />
        </Field>
        <Field label="Price (LKR)" htmlFor={uid('price')}>
          <Input id={uid('price')} name="price" type="number" min={0} step="0.01" required defaultValue={test?.price} />
        </Field>
        <Field label="Sample type" htmlFor={uid('sample')}>
          <Input id={uid('sample')} name="sampleType" placeholder="Blood, Urine…" defaultValue={test?.sampleType ?? ''} />
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
      {doctor && <input type="hidden" name="id" value={doctor.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={uid('name')} className="sm:col-span-2">
          <Input id={uid('name')} name="name" required placeholder="Dr. " defaultValue={doctor?.name} />
        </Field>
        <Field label="Specialty" htmlFor={uid('spec')}>
          <Input id={uid('spec')} name="specialty" defaultValue={doctor?.specialty ?? ''} />
        </Field>
        <Field label="Hospital / clinic" htmlFor={uid('hosp')}>
          <Input id={uid('hosp')} name="hospital" defaultValue={doctor?.hospital ?? ''} />
        </Field>
        <Field label="Phone" htmlFor={uid('phone')}>
          <Input id={uid('phone')} name="phone" type="tel" defaultValue={doctor?.phone ?? ''} />
        </Field>
        <Field label="Email" htmlFor={uid('email')}>
          <Input id={uid('email')} name="email" type="email" defaultValue={doctor?.email ?? ''} />
        </Field>
      </div>
    </CrudForm>
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
      {partner && <input type="hidden" name="id" value={partner.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Laboratory name" htmlFor={uid('name')} className="sm:col-span-2">
          <Input id={uid('name')} name="name" required defaultValue={partner?.name} />
        </Field>
        <Field label="Contact person" htmlFor={uid('contact')}>
          <Input id={uid('contact')} name="contactPerson" defaultValue={partner?.contactPerson ?? ''} />
        </Field>
        <Field label="Phone" htmlFor={uid('phone')}>
          <Input id={uid('phone')} name="phone" type="tel" defaultValue={partner?.phone ?? ''} />
        </Field>
        <Field label="Email" htmlFor={uid('email')}>
          <Input id={uid('email')} name="email" type="email" defaultValue={partner?.email ?? ''} />
        </Field>
        <Field label="Address" htmlFor={uid('address')}>
          <Input id={uid('address')} name="address" defaultValue={partner?.address ?? ''} />
        </Field>
      </div>
    </CrudForm>
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
      submitLabel={template ? 'Save' : 'Create template'}
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
      <Field label="Template name" htmlFor={uid('name')}>
        <Input id={uid('name')} name="name" required placeholder="e.g. Full Body Checkup" defaultValue={template?.name} />
      </Field>
      <Field label="Description" htmlFor={uid('desc')}>
        <Input id={uid('desc')} name="description" defaultValue={template?.description ?? ''} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          Tests ({selected.length}) · {formatLKR(total)}
        </legend>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter tests" aria-label="Filter tests" />
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
          {visible.map((t) => {
            const checked = selected.includes(t.id)
            return (
              <li key={t.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
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
                  <span className="flex-1">{t.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatLKR(t.price)}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
    </CrudForm>
  )
}
