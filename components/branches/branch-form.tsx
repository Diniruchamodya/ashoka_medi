'use client'

import { useActionState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { deleteBranch, saveBranch } from '@/app/actions/branches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CrudForm } from '@/components/lab/crud-form'
import { Field } from '@/components/lab/page-parts'

export function BranchForm({
  branch,
  onSuccess,
}: {
  branch?: { id: number; name: string }
  onSuccess?: () => void
}) {
  const uid = `branch-${branch?.id ?? 'new'}-name`
  return (
    <CrudForm
      action={saveBranch}
      submitLabel={branch ? 'Save branch' : 'Add branch'}
      resetOnSuccess={!branch}
      onSuccess={onSuccess}
    >
      {branch && <input type="hidden" name="id" value={branch.id} />}
      <Field label="Branch name" htmlFor={uid}>
        <Input id={uid} name="name" required defaultValue={branch?.name ?? ''} />
      </Field>
    </CrudForm>
  )
}

export function BranchDeleteButton({ id, name }: { id: number; name: string }) {
  const [state, action, pending] = useActionState(deleteBranch, undefined)
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm(`Permanently delete branch "${name}"?`)) event.preventDefault()
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${name}`}
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
        </Button>
      </form>
      {state?.error && (
        <p className="max-w-64 text-right text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </div>
  )
}
