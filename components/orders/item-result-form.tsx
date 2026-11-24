'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FilePenLine, Loader2 } from 'lucide-react'
import { saveOrderItemResult } from '@/app/actions/test-results'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { OrderedTestResult, ReportTemplateConfiguration } from '@/lib/db/schema'

type Parameter = ReportTemplateConfiguration['parameters'][number]

export function ItemResultForm({
  itemId,
  testName,
  configuration,
  savedResult,
  buttonLabel = 'Enter Results',
}: {
  itemId: number
  testName: string
  configuration: ReportTemplateConfiguration | null
  savedResult: OrderedTestResult | null
  buttonLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const parameters: Parameter[] = configuration?.parameters.length
    ? configuration.parameters
    : [{ name: 'Result', unit: '', referenceInterval: '' }]
  const savedValues = new Map(
    (savedResult?.parameters ?? []).map((parameter) => [parameter.name.toLowerCase(), parameter.value]),
  )

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('itemId', String(itemId))
    setError(null)
    startTransition(async () => {
      const state = await saveOrderItemResult(formData)
      if (state?.error) {
        setError(state.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) setError(null)
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FilePenLine aria-hidden />
        {buttonLabel}
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{buttonLabel === 'Record Result' ? 'Record result' : 'Enter results'}</DialogTitle>
          <DialogDescription>
            Save results for {testName}. They will remain attached to this ordered test.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {parameters.map((parameter, index) => (
            <div key={`${parameter.name}-${index}`} className="flex flex-col gap-1.5">
              <label htmlFor={`result-${itemId}-${index}`} className="text-sm font-medium">
                {parameter.name}
              </label>
              <input type="hidden" name="parameterName" value={parameter.name} />
              <Input
                id={`result-${itemId}-${index}`}
                name="value"
                defaultValue={savedValues.get(parameter.name.toLowerCase()) ?? ''}
                required
                maxLength={2000}
                autoComplete="off"
              />
              {(parameter.unit || parameter.referenceInterval) && (
                <p className="text-xs text-muted-foreground">
                  {[parameter.unit, parameter.referenceInterval].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Save results
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
