'use client'

import { useActionState, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createPatient } from '@/app/actions/patients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, selectClass } from '@/components/lab/page-parts'

type Created = { id: number; patientCode: string; fullName: string; phone: string | null }

export type PatientFieldValues = {
  fullName: string
  gender: string
  phone: string
  email: string
  address: string
}

export function PatientFields({
  values,
  onValueChange,
  fullNameError,
  idPrefix = 'patient',
}: {
  values: PatientFieldValues
  onValueChange?: (key: keyof PatientFieldValues, value: string) => void
  fullNameError?: string
  idPrefix?: string
}) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name *" htmlFor={id('fullName')} className="sm:col-span-2">
        <Input
          id={id('fullName')}
          name="fullName"
          required
          value={values.fullName}
          onChange={(event) => onValueChange?.('fullName', event.target.value)}
          aria-invalid={Boolean(fullNameError)}
          aria-describedby={fullNameError ? id('fullName-error') : undefined}
        />
        {fullNameError && (
          <p id={id('fullName-error')} className="text-sm text-destructive" role="alert">
            {fullNameError}
          </p>
        )}
      </Field>
      <Field label="Gender" htmlFor={id('gender')}>
        <select
          id={id('gender')}
          name="gender"
          value={values.gender}
          onChange={(event) => onValueChange?.('gender', event.target.value)}
          className={selectClass}
        >
          <option value="">Not specified</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Phone" htmlFor={id('phone')}>
        <Input
          id={id('phone')}
          name="phone"
          type="tel"
          value={values.phone}
          onChange={(event) => onValueChange?.('phone', event.target.value)}
          placeholder="07X XXX XXXX"
        />
      </Field>
      <Field label="Email" htmlFor={id('email')}>
        <Input
          id={id('email')}
          name="email"
          type="email"
          value={values.email}
          onChange={(event) => onValueChange?.('email', event.target.value)}
        />
      </Field>
      <Field label="Address" htmlFor={id('address')}>
        <Input
          id={id('address')}
          name="address"
          value={values.address}
          onChange={(event) => onValueChange?.('address', event.target.value)}
        />
      </Field>
    </div>
  )
}

export function PatientQuickForm({ onCreated }: { onCreated?: (p: Created) => void }) {
  const [state, action, pending] = useActionState(createPatient, undefined)
  const [values, setValues] = useState<PatientFieldValues>({
    fullName: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
  })
  const [nameWasEdited, setNameWasEdited] = useState(false)

  useEffect(() => {
    if (!state?.nonce) return
    setValues({ fullName: '', gender: '', phone: '', email: '', address: '' })
    if (state.patient) onCreated?.(state.patient)
  }, [state?.nonce, onCreated])

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={() => setNameWasEdited(false)}
    >
      <PatientFields
        values={values}
        onValueChange={(key, value) => {
          setValues((current) => ({ ...current, [key]: value }))
          if (key === 'fullName') setNameWasEdited(true)
        }}
        fullNameError={nameWasEdited ? undefined : state?.fieldErrors?.fullName}
      />
      {state?.error && !state.fieldErrors?.fullName && (
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
