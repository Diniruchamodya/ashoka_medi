'use client'

import { cloneElement, useActionState, useEffect, useRef, useState, useTransition, type ReactElement } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import type { CrudState } from '@/app/actions/catalog'
import { Button } from '@/components/ui/button'

export type CrudFormContext = {
  state: CrudState
  values: Record<string, string>
  setValue: (name: string, value: string) => void
}

export function CrudForm({
  action,
  submitLabel,
  children,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (state: CrudState, fd: FormData) => Promise<CrudState>
  submitLabel: string
  children: React.ReactNode | ((context: CrudFormContext) => React.ReactNode)
  resetOnSuccess?: boolean
  onSuccess?: () => void
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [values, setValues] = useState<Record<string, string>>({})
  const ref = useRef<HTMLFormElement>(null)
  const renderFields = typeof children === 'function'
  const setValue = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }))

  useEffect(() => {
    if (state?.success) {
      if (resetOnSuccess) {
        ref.current?.reset()
        setValues({})
      }
      onSuccess?.()
    }
  }, [state?.nonce, state?.success, resetOnSuccess, onSuccess])

  return (
    <form
      ref={ref}
      action={formAction}
      className="flex flex-col gap-4"
      onSubmit={
        renderFields
          ? (event) => {
              const entries = Array.from(new FormData(event.currentTarget).entries())
              setValues(Object.fromEntries(entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string')))
            }
          : undefined
      }
    >
      {renderFields ? children({ state, values, setValue }) : children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
        {state?.error && !state.nameError && !state.phoneError && !state.emailError && (
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

export function EditToggle({
  label,
  children,
}: {
  label: string
  children: ReactElement<{ onSuccess?: () => void }>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen((v) => !v)} aria-label={label} aria-expanded={open}>
        <Pencil aria-hidden />
      </Button>
      {open && (
        <div className="basis-full rounded-lg border border-border bg-muted/40 p-4">
          {cloneElement(children, { onSuccess: () => setOpen(false) })}
        </div>
      )}
    </>
  )
}

export function DeleteButton({
  action,
  id,
  label,
  confirmText,
}: {
  action: (fd: FormData) => Promise<void>
  id: number
  label: string
  confirmText: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive"
      onClick={() => {
        if (!window.confirm(confirmText)) return
        const fd = new FormData()
        fd.set('id', String(id))
        startTransition(() => action(fd))
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
    </Button>
  )
}
