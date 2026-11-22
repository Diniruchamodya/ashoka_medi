'use client'

import { useTransition } from 'react'
import { Printer, XCircle } from 'lucide-react'
import { cancelOrder } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'

export function OrderActions({ orderId, canCancel }: { orderId: number; canCancel: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={() => window.print()}>
        <Printer aria-hidden /> Print
      </Button>
      {canCancel && (
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('Cancel this order? This cannot be undone.')) return
            const fd = new FormData()
            fd.set('orderId', String(orderId))
            startTransition(() => cancelOrder(fd))
          }}
        >
          <XCircle aria-hidden /> Cancel order
        </Button>
      )}
    </div>
  )
}
