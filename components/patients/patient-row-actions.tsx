'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { deletePatient } from '@/app/actions/patients'
import { PatientEditForm, type EditablePatient } from '@/components/patients/patient-edit-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function PatientRowActions({ patient }: { patient: EditablePatient }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [state, action, pending] = useActionState(deletePatient, undefined)
  const router = useRouter()
  const closeEdit = useCallback(() => setEditOpen(false), [])

  useEffect(() => {
    if (state?.success) {
      setDeleteOpen(false)
      router.refresh()
    }
  }, [state?.nonce, state?.success, router])

  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil aria-hidden />
        Edit
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
        <Trash2 aria-hidden />
        Delete
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit patient</DialogTitle>
            <DialogDescription>Update the registration details for {patient.fullName}.</DialogDescription>
          </DialogHeader>
          <PatientEditForm patient={patient} onSuccess={closeEdit} />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete patient?</DialogTitle>
            <DialogDescription>
              Permanently delete {patient.fullName}? Patients with retained orders, reports, payments, or other linked records cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <form action={action}>
              <input type="hidden" name="id" value={patient.id} />
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Delete patient
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
