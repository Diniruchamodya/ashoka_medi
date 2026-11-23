'use client'

import { Button } from '@/components/ui/button'

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section
      role="alert"
      className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center gap-4 text-center"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">This page could not load</h1>
        <p className="text-sm text-muted-foreground">
          A temporary error prevented the page from loading. Please try again.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </section>
  )
}
