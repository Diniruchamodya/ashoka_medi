'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { createStaff, deactivateStaff, deleteStaff, updateStaff } from '@/app/actions/staff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EditToggle } from '@/components/lab/crud-form'
import { Field, selectClass } from '@/components/lab/page-parts'
import { ROLES, ROLE_LABELS } from '@/lib/permissions'
import { validateSriLankanPhone } from '@/lib/phone-validation'

export function StaffForm({
  staff,
  branches,
  onSuccess,
  isCurrentUser = false,
}: {
  staff?: {
    userId: string
    name: string
    email: string
    phone: string | null
    role: string
    branchIds: number[]
    active: boolean
  }
  branches: { id: number; name: string }[]
  onSuccess?: () => void
  isCurrentUser?: boolean
}) {
  if (!staff) return <CreateStaffForm branches={branches} onSuccess={onSuccess} />

  return <UpdateStaffForm staff={staff} branches={branches} onSuccess={onSuccess} isCurrentUser={isCurrentUser} />
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
  const [passwordWasEdited, setPasswordWasEdited] = useState(false)
  const ref = useRef<HTMLFormElement>(null)
  const localPhoneError = phoneWasValidated ? validateSriLankanPhone(phone) : undefined
  const phoneError = localPhoneError ?? (phoneWasEdited ? undefined : state?.phoneError)
  const passwordError = passwordWasEdited ? undefined : state?.passwordError
  const uid = (key: string) => `staff-new-${key}`

  useEffect(() => {
    if (state?.success) {
      ref.current?.reset()
      setPhone('')
      setPhoneWasValidated(false)
      setPhoneWasEdited(false)
      setPasswordWasEdited(false)
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
        const error = validateSriLankanPhone(phone)
        if (error) return

        setPhoneWasEdited(false)
        setPasswordWasEdited(false)
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
          <Input
            id={uid('password')}
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            onChange={() => setPasswordWasEdited(true)}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? uid('password-error') : undefined}
          />
          {passwordError && (
            <p id={uid('password-error')} className="text-sm text-destructive" role="alert">
              {passwordError}
            </p>
          )}
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
      <StaffAccessFields
        key={state?.nonce ?? 'new'}
        branches={branches}
        idPrefix="staff-new"
        branchError={state?.branchError}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden />}
          Create account
        </Button>
        {state?.error && !state.phoneError && !state.passwordError && !state.branchError && (
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
  isCurrentUser,
}: {
  staff: {
    userId: string
    name: string
    email: string
    phone: string | null
    role: string
    branchIds: number[]
    active: boolean
  }
  branches: { id: number; name: string }[]
  onSuccess?: () => void
  isCurrentUser: boolean
}) {
  const [state, action, pending] = useActionState(updateStaff, undefined)
  const [nameClientError, setNameClientError] = useState<string>()
  const [emailClientError, setEmailClientError] = useState<string>()
  const [nameWasEdited, setNameWasEdited] = useState(false)
  const [emailWasEdited, setEmailWasEdited] = useState(false)
  const [phone, setPhone] = useState(staff.phone ?? '')
  const [phoneWasValidated, setPhoneWasValidated] = useState(false)
  const [phoneWasEdited, setPhoneWasEdited] = useState(false)
  const nameError = nameClientError ?? (nameWasEdited ? undefined : state?.nameError)
  const emailError = emailClientError ?? (emailWasEdited ? undefined : state?.emailError)
  const localPhoneError = phoneWasValidated ? validateSriLankanPhone(phone) : undefined
  const phoneError = localPhoneError ?? (phoneWasEdited ? undefined : state?.phoneError)
  const uid = (key: string) => `staff-${staff.userId}-${key}`

  useEffect(() => {
    if (state?.success) onSuccess?.()
  }, [state?.nonce, state?.success, onSuccess])

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={() => {
        setNameWasEdited(false)
        setEmailWasEdited(false)
        setPhoneWasEdited(false)
      }}
    >
      <input type="hidden" name="userId" value={staff.userId} />
      <Field label="Full name" htmlFor={uid('name')}>
        <Input
          id={uid('name')}
          name="name"
          required
          defaultValue={staff.name}
          onChange={() => {
            setNameWasEdited(true)
            setNameClientError(undefined)
          }}
          onInvalid={() => setNameClientError('Enter a full name.')}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? uid('name-error') : undefined}
        />
        {nameError && <InlineFieldError id={uid('name-error')}>{nameError}</InlineFieldError>}
      </Field>
      <Field label="Email" htmlFor={uid('email')}>
        <Input
          id={uid('email')}
          name="email"
          type="email"
          autoComplete="off"
          required
          defaultValue={staff.email}
          onChange={() => {
            setEmailWasEdited(true)
            setEmailClientError(undefined)
          }}
          onInvalid={(event) =>
            setEmailClientError(
              event.currentTarget.value ? 'Enter a valid email address.' : 'Enter an email address.',
            )
          }
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? uid('email-error') : undefined}
        />
        {emailError && <InlineFieldError id={uid('email-error')}>{emailError}</InlineFieldError>}
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
        {phoneError && <InlineFieldError id={uid('phone-error')}>{phoneError}</InlineFieldError>}
      </Field>
      <StaffAccessFields
        branches={branches}
        role={staff.role}
        branchIds={staff.branchIds}
        idPrefix={`staff-${staff.userId}`}
        branchError={state?.branchError}
      />
      {isCurrentUser ? (
        <>
          <input type="hidden" name="active" value="on" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked disabled className="size-4 accent-[var(--primary)]" />
            Account active
          </label>
          <p className="text-xs text-muted-foreground">You cannot deactivate your own account.</p>
        </>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={staff.active}
            className="size-4 accent-[var(--primary)]"
          />
          Account active
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save changes
        </Button>
        {state?.error &&
          !nameError &&
          !emailError &&
          !phoneError &&
          !state.branchError && (
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

function InlineFieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {children}
    </p>
  )
}

export function StaffRowActions({
  staff,
  branches,
  isCurrentUser,
}: {
  staff: {
    userId: string
    name: string
    email: string
    phone: string | null
    role: string
    branchIds: number[]
    active: boolean
  }
  branches: { id: number; name: string }[]
  isCurrentUser: boolean
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStaff, undefined)
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(deactivateStaff, undefined)
  const showDeactivate =
    deleteState?.offerDeactivate && staff.active && !deactivateState?.success && !isCurrentUser

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1">
        <EditToggle label={`Edit ${staff.name}`}>
          <StaffForm staff={staff} branches={branches} isCurrentUser={isCurrentUser} />
        </EditToggle>
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(`Permanently delete the account for "${staff.name}"?`)) event.preventDefault()
          }}
        >
          <input type="hidden" name="userId" value={staff.userId} />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${staff.name}`}
            title={isCurrentUser ? 'You cannot delete your own account.' : undefined}
            disabled={deletePending || isCurrentUser}
            className="text-muted-foreground hover:text-destructive"
          >
            {deletePending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
          </Button>
        </form>
      </div>
      {!deactivateState?.success && (deleteState?.error || deactivateState?.error) && (
        <p className="max-w-72 text-right text-xs text-destructive" role="alert">
          {deactivateState?.error ?? deleteState?.error}
        </p>
      )}
      {showDeactivate && (
        <form action={deactivateAction}>
          <input type="hidden" name="userId" value={staff.userId} />
          <Button type="submit" variant="outline" size="sm" disabled={deactivatePending}>
            {deactivatePending && <Loader2 className="animate-spin" aria-hidden />}
            Deactivate instead
          </Button>
        </form>
      )}
      {deactivateState?.success && (
        <p className="max-w-72 text-right text-xs text-success" role="status">
          {deactivateState.success}
        </p>
      )}
    </div>
  )
}

function StaffAccessFields({
  branches,
  role,
  branchIds = [],
  idPrefix,
  branchError,
}: {
  branches: { id: number; name: string }[]
  role?: string
  branchIds?: number[]
  idPrefix: string
  branchError?: string
}) {
  const [selectedRole, setSelectedRole] = useState(role ?? 'receptionist')
  const [selectedBranchIds, setSelectedBranchIds] = useState(branchIds)

  return (
    <>
      <Field label="Role" htmlFor={`${idPrefix}-role`}>
        <select
          id={`${idPrefix}-role`}
          name="role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
          className={selectClass}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>
      {selectedRole === 'admin' ? (
        <div>
          <p className="text-sm text-muted-foreground">All branches</p>
          {branchError && (
            <p className="text-sm text-destructive" role="alert">
              {branchError}
            </p>
          )}
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2" aria-invalid={Boolean(branchError)}>
          <legend className="mb-1.5 text-sm font-medium">Branch access</legend>
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No branches are available. Add a branch first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="branchIds"
                    value={branch.id}
                    checked={selectedBranchIds.includes(branch.id)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked
                      setSelectedBranchIds((current) =>
                        checked
                          ? [...current, branch.id]
                          : current.filter((id) => id !== branch.id),
                      )
                    }}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {branch.name}
                </label>
              ))}
            </div>
          )}
          {branchError ? (
            <p className="text-sm text-destructive" role="alert">
              {branchError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Select at least one branch.</p>
          )}
        </fieldset>
      )}
    </>
  )
}
