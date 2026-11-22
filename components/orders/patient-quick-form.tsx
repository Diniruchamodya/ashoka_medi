'use client'

import { useActionState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { createPatient } from '@/app/actions/patients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, selectClass } from '@/components/lab/page-parts'

type Created = { id: number; patientCode: string; fullName: string; phone: string | null }

export function PatientFields({ defaults }: { defaults?: Record<string, string | null> }) {
  const d = defaults ?? {}
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name *" htmlFor="fullName" className="sm:col-span-2">
        <Input id="fullName" name="fullName" required defaultValue={d.fullName ?? ''} />
      </Field>
      <Field label="Gender" htmlFor="gender">
        <select id="gender" name="gender" defaultValue={d.gender ?? ''} className={selectClass}>
          <option value="">Not specified</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Date of birth" htmlFor="dateOfBirth">
        <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={d.dateOfBirth ?? ''} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={d.phone ?? ''} placeholder="07X XXX XXXX" />
      </Field>
      <Field label="NIC" htmlFor="nic">
        <Input id="nic" name="nic" defaultValue={d.nic ?? ''} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={d.email ?? ''} />
      </Field>
      <Field label="Address" htmlFor="address">
        <Input id="address" name="address" defaultValue={d.address ?? ''} />
      </Field>
    </div>
  )
}

export function PatientQuickForm({ onCreated }: { onCreated?: (p: Created) => void }) {
  const [state, action, pending] = useActionState(createPatient, undefined)

  useEffect(() => {
    if (state?.patient) onCreated?.(state.patient)
  }, [state, onCreated])

  return (
    <form action={action} className="flex flex-col gap-4">
      <PatientFields />
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && !onCreated && (
        <p className="text-sm text-success" role="status">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Register patient
      </Button>
    </form>
  )
}
