'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { updatePatient } from '@/app/actions/patients'
import { Button } from '@/components/ui/button'
import { PatientFields, type PatientFieldValues } from '@/components/orders/patient-quick-form'
import { validateOptionalEmail, validateOptionalPhone } from '@/lib/form-validation'

export type EditablePatient = {
  id: number
  fullName: string
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
}

function patientValues(patient: EditablePatient): PatientFieldValues {
  return {
    fullName: patient.fullName,
    gender: patient.gender ?? '',
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    address: patient.address ?? '',
  }
}

export function PatientEditForm({
  patient,
  onSuccess,
}: {
  patient: EditablePatient
  onSuccess?: () => void
}) {
  const [state, action, pending] = useActionState(updatePatient, undefined)
  const [values, setValues] = useState(() => patientValues(patient))
  const [nameWasEdited, setNameWasEdited] = useState(false)
  const [phoneWasEdited, setPhoneWasEdited] = useState(false)
  const [emailWasEdited, setEmailWasEdited] = useState(false)
  const router = useRouter()
  const idPrefix = `patient-${patient.id}-edit`

  useEffect(() => {
    if (state?.nonce) {
      setNameWasEdited(false)
      setPhoneWasEdited(false)
      setEmailWasEdited(false)
    }
    if (state?.success) {
      router.refresh()
      onSuccess?.()
    }
  }, [state?.nonce, state?.success, onSuccess, router])

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        setNameWasEdited(true)
        setPhoneWasEdited(true)
        setEmailWasEdited(true)
        if (
          !values.fullName.trim() ||
          validateOptionalPhone(values.phone) ||
          validateOptionalEmail(values.email)
        ) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={patient.id} />
      <PatientFields
        values={values}
        onValueChange={(key, value) => {
          setValues((current) => ({ ...current, [key]: value }))
          if (key === 'fullName') setNameWasEdited(true)
          if (key === 'phone') setPhoneWasEdited(true)
          if (key === 'email') setEmailWasEdited(true)
        }}
        fullNameError={
          nameWasEdited
            ? values.fullName.trim() ? undefined : 'Patient name is required.'
            : state?.fieldErrors?.fullName
        }
        phoneError={phoneWasEdited ? validateOptionalPhone(values.phone) : state?.fieldErrors?.phone}
        emailError={emailWasEdited ? validateOptionalEmail(values.email) : state?.fieldErrors?.email}
        idPrefix={idPrefix}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save changes
        </Button>
        {state?.error &&
          !state.fieldErrors?.fullName &&
          !state.fieldErrors?.phone &&
          !state.fieldErrors?.email && (
          <p className="text-sm text-destructive" role="alert">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-success" role="status">{state.success}</p>
        )}
      </div>
    </form>
  )
}
