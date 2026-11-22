'use client'

import { createStaff, updateStaff } from '@/app/actions/staff'
import { Input } from '@/components/ui/input'
import { CrudForm } from '@/components/lab/crud-form'
import { Field, selectClass } from '@/components/lab/page-parts'
import { ROLES, ROLE_LABELS } from '@/lib/permissions'

export function StaffForm({
  staff,
  branches,
  onSuccess,
}: {
  staff?: { userId: string; role: string; branchIds: number[]; active: boolean }
  branches: { id: number; name: string }[]
  onSuccess?: () => void
}) {
  const uid = (key: string) => `staff-${staff?.userId ?? 'new'}-${key}`
  return (
    <CrudForm
      action={staff ? updateStaff : createStaff}
      submitLabel={staff ? 'Save access' : 'Create account'}
      resetOnSuccess={!staff}
      onSuccess={onSuccess}
    >
      {staff ? (
        <input type="hidden" name="userId" value={staff.userId} />
      ) : (
        <>
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
              <Input id={uid('phone')} name="phone" type="tel" />
            </Field>
          </div>
        </>
      )}
      <Field label="Role" htmlFor={uid('role')}>
        <select id={uid('role')} name="role" defaultValue={staff?.role ?? 'receptionist'} className={selectClass}>
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
                defaultChecked={staff?.branchIds.includes(b.id)}
                className="size-4 accent-[var(--primary)]"
              />
              {b.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Administrators can access every branch.</p>
      </fieldset>
      {staff && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={staff.active} className="size-4 accent-[var(--primary)]" />
          Account active
        </label>
      )}
    </CrudForm>
  )
}
