'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { createStaff, updateStaff } from '@/app/actions/staff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CrudForm } from '@/components/lab/crud-form'
import { Field, selectClass } from '@/components/lab/page-parts'
import { ROLES, ROLE_LABELS } from '@/lib/permissions'
import { validateSriLankanPhone } from '@/lib/phone-validation'

export function StaffForm({
  staff,
  branches,
  onSuccess,
}: {
  staff?: { userId: string; role: string; branchIds: number[]; active: boolean }
  branches: { id: number; name: string }[]
  onSuccess?: () => void
}) {
  if (!staff) return <CreateStaffForm branches={branches} onSuccess={onSuccess} />

  return <UpdateStaffForm staff={staff} branches={branches} onSuccess={onSuccess} />
}

function CreateStaffForm({
  branches,
  onSuccess,
}: {
  branches: { id: number; name: string }[]
  onSuccess?: () => void
}) {
  const [state, formAction] = useActionState(createStaff, undefined)
  const [isPending, startTransition] = useTransition()
  const [phone, setPhone] = useState('')
  const [phoneWasValidated, setPhoneWasValidated] = useState(false)
  const [phoneWasEdited, setPhoneWasEdited] = useState(false)
  const ref = useRef<HTMLFormElement>(null)
  const localPhoneError = phoneWasValidated ? validateSriLankanPhone(phone) : undefined
  const phoneError = localPhoneError ?? (phoneWasEdited ? undefined : state?.phoneError)
  const uid = (key: string) => `staff-new-${key}`

  useEffect(() => {
    if (state?.success) {
      ref.current?.reset()
      setPhone('')
      setPhoneWasValidated(false)
      setPhoneWasEdited(false)
      onSuccess?.()
    }
  }, [state?.nonce, state?.success, onSuccess])

  return (
    <form
      ref={ref}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        setPhoneWasValidated(true)
        setPhoneWasEdited(false)
        const error = validateSriLankanPhone(phone)
        if (error) return

        const formData = new FormData(event.currentTarget)
        startTransition(() => formAction(formData))
      }}
    >
      <Field label="Full name" htmlFor={uid('name')}>
        <Input id={uid('name')} name="name" required />
      </Field>
      <Field label="Email" htmlFor={uid('email')}>
        <Input id={uid('email')} name="email" type="email" required autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Temporary password" htmlFor={uid('password')}>
          <Input id={uid('password')} name="password" type="password" minLength={8} required autoComplete="new-password" />
        </Field>
        <Field label="Phone" htmlFor={uid('phone')}>
          <Input
            id={uid('phone')}
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              setPhoneWasEdited(true)
            }}
            onInvalid={() => setPhoneWasValidated(true)}
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? uid('phone-error') : undefined}
          />
          {phoneError && (
            <p id={uid('phone-error')} className="text-sm text-destructive" role="alert">
              {phoneError}
            </p>
          )}
        </Field>
      </div>
      <StaffAccessFields branches={branches} idPrefix="staff-new" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden />}
          Create account
        </Button>
        {state?.error && !state.phoneError && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="text-sm text-success" role="status">
            {state.success}
          </p>
        )}
      </div>
    </form>
  )
}

function UpdateStaffForm({
  staff,
  branches,
  onSuccess,
}: {
  staff: { userId: string; role: string; branchIds: number[]; active: boolean }
  branches: { id: number; name: string }[]
  onSuccess?: () => void
}) {
  return (
    <CrudForm
      action={updateStaff}
      submitLabel="Save access"
      onSuccess={onSuccess}
    >
      <input type="hidden" name="userId" value={staff.userId} />
      <StaffAccessFields
        branches={branches}
        role={staff.role}
        branchIds={staff.branchIds}
        idPrefix={`staff-${staff.userId}`}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={staff.active} className="size-4 accent-[var(--primary)]" />
        Account active
      </label>
    </CrudForm>
  )
}

function StaffAccessFields({
  branches,
  role,
  branchIds = [],
  idPrefix,
}: {
  branches: { id: number; name: string }[]
  role?: string
  branchIds?: number[]
  idPrefix: string
}) {
  return (
    <>
      <Field label="Role" htmlFor={`${idPrefix}-role`}>
        <select id={`${idPrefix}-role`} name="role" defaultValue={role ?? 'receptionist'} className={selectClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Branch access</legend>
        <div className="grid grid-cols-2 gap-2">
          {branches.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="branchIds"
                value={b.id}
                defaultChecked={branchIds.includes(b.id)}
                className="size-4 accent-[var(--primary)]"
              />
              {b.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Administrators can access every branch.</p>
      </fieldset>
    </>
  )
}
