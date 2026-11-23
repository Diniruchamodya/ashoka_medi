'use client'

import { useState, useTransition } from 'react'
import { Download, FileText, Loader2, MessageSquareText } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { sendReportReadySms } from '@/app/actions/report-sms'
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
  smsConfigured,
  smsStatus,
}: {
  itemId: number
  testName: string
  patientPhone: string | null
  previewAvailable: boolean
  reportReady: boolean
  smsConfigured: boolean
  smsStatus?: string | null
}) {
  const [smsDialogOpen, setSmsDialogOpen] = useState(false)
  const [smsError, setSmsError] = useState<string | null>(null)
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null)
  const [sendingSms, startSmsTransition] = useTransition()
  const [smsSubmitted, setSmsSubmitted] = useState(smsStatus === 'submitted')
  const [smsPending, setSmsPending] = useState(smsStatus === 'pending')
  const previewHref = `/api/orders/items/${itemId}/result?disposition=inline`
  const downloadHref = `/api/orders/items/${itemId}/result`

  function confirmSms() {
    setSmsError(null)
    setSmsSuccess(null)
    startSmsTransition(async () => {
      try {
        const state = await sendReportReadySms(itemId)
        if (state?.success || state?.submitted) {
          setSmsSubmitted(true)
          setSmsPending(false)
          setSmsSuccess('SMS submitted')
          return
        }
        setSmsError(state?.error ?? 'Could not submit the SMS.')
        if (state?.pending) setSmsPending(true)
      } catch {
        setSmsError('Could not submit the SMS. Please try again.')
      }
    })
  }

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
          disabled={!reportReady || smsSubmitted || smsPending}
          onClick={() => {
            setSmsError(null)
            setSmsSuccess(null)
            setSmsDialogOpen(true)
          }}
        >
          <MessageSquareText aria-hidden />
          {smsSubmitted ? 'SMS submitted' : smsPending ? 'SMS pending' : 'Send SMS'}
        </Button>
        {smsPending && (
          <span className="self-center text-xs text-muted-foreground" role="status">
            SMS submission is awaiting confirmation. Contact an administrator before retrying.
          </span>
        )}
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
            {!smsConfigured && (
              <p className="text-destructive" role="status">
                SMS service is not configured.
              </p>
            )}
            {smsError && <p className="text-destructive" role="alert">{smsError}</p>}
            {smsSuccess && <p className="text-primary" role="status">{smsSuccess}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={sendingSms}
              onClick={() => setSmsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!smsConfigured || sendingSms || smsSubmitted || smsPending}
              title={!smsConfigured ? 'SMS service is not configured' : undefined}
              onClick={confirmSms}
            >
              {sendingSms && <Loader2 className="animate-spin" aria-hidden />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
