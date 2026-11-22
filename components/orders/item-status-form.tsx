'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { updateItemStatus } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { selectClass } from '@/components/lab/page-parts'
import { ITEM_STATUSES, ITEM_STATUS_LABELS } from '@/lib/permissions'
import { cn } from '@/lib/utils'

export function ItemStatusForm({
  itemId,
  status,
  result,
  partnerId,
  partners,
}: {
  itemId: number
  status: string
  result: string | null
  partnerId: number | null
  partners: { id: number; name: string }[]
}) {
  const [next, setNext] = useState(status)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fd = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await updateItemStatus(fd)
      } catch {
        setError('Could not update this test.')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 lg:w-[460px]">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="flex flex-wrap gap-2">
        <select
          name="status"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-label="Test status"
          className={cn(selectClass, 'w-40')}
        >
          {ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ITEM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {next === 'outsourced' && (
          <select
            name="partnerId"
            defaultValue={partnerId ?? ''}
            aria-label="Partner lab"
            required={!partnerId}
            className={cn(selectClass, 'w-44')}
          >
            <option value="" disabled>
              Partner lab
            </option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <Input
          name="result"
          defaultValue={result ?? ''}
          placeholder={next === 'completed' ? 'Result / remarks' : 'Remarks (optional)'}
          aria-label="Result or remarks"
          className="min-w-32 flex-1"
        />
        <Button type="submit" size="sm" disabled={pending} className="h-8">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Update
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
