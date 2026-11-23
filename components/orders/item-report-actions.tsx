'use client'

import { useState } from 'react'
import { Download, FileText, MessageSquareText } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ItemReportActions({
  itemId,
  testName,
  patientPhone,
  previewAvailable,
  reportReady,
}: {
  itemId: number
  testName: string
  patientPhone: string | null
  previewAvailable: boolean
  reportReady: boolean
}) {
  const [smsDialogOpen, setSmsDialogOpen] = useState(false)
  const previewHref = `/api/orders/items/${itemId}/result?disposition=inline`
  const downloadHref = `/api/orders/items/${itemId}/result`

  return (
    <>
      {previewAvailable ? (
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FileText aria-hidden />
          Enter Results
        </a>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled>
          <FileText aria-hidden />
          Enter Results
        </Button>
      )}
      {!previewAvailable && (
        <span className="self-center text-xs text-muted-foreground" role="status">
          PDF not available yet.
        </span>
      )}
      {reportReady && (
        <a
          href={downloadHref}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Download aria-hidden />
          Download Result (PDF)
        </a>
      )}

      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!reportReady}
          onClick={() => setSmsDialogOpen(true)}
        >
          <MessageSquareText aria-hidden />
          Send SMS
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send report-ready SMS</DialogTitle>
            <DialogDescription>
              Confirm the message for {testName}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="font-medium">Patient mobile:</span> {patientPhone || '—'}
            </p>
            <p>
              <span className="font-medium">Message:</span>{' '}
              <q>Report is ready</q>
            </p>
            <p className="text-destructive" role="status">
              SMS service is not configured.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSmsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled title="SMS service is not configured">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
