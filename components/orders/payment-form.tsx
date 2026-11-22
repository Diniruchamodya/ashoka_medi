'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { recordPayment } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, selectClass } from '@/components/lab/page-parts'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/permissions'

export function PaymentForm({ orderId, balance }: { orderId: number; balance: number }) {
  const [state, action, pending] = useActionState(recordPayment, undefined)

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-border pt-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (LKR)" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={balance}
            defaultValue={balance.toFixed(2)}
            required
          />
        </Field>
        <Field label="Method" htmlFor="pay-method">
          <select id="pay-method" name="method" className={selectClass}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-success" role="status">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Record payment
      </Button>
    </form>
  )
}
