'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { updatePatient } from '@/app/actions/patients'
import { Button } from '@/components/ui/button'
import { PatientFields } from '@/components/orders/patient-quick-form'

export function PatientEditForm({ patient }: { patient: { id: number } & Record<string, unknown> }) {
  const [state, action, pending] = useActionState(updatePatient, undefined)
  const defaults = Object.fromEntries(
    Object.entries(patient).map(([k, v]) => [k, v == null ? null : String(v)]),
  ) as Record<string, string | null>

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={patient.id} />
      <PatientFields defaults={defaults} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save profile
        </Button>
        {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
        {state?.success && <p className="text-sm text-success" role="status">{state.success}</p>}
      </div>
    </form>
  )
}
