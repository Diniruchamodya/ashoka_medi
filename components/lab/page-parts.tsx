import { cn } from '@/lib/utils'
import { ITEM_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/lib/permissions'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col rounded-xl border border-border bg-card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: 'default' | 'primary' | 'warning' | 'success'
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            tone === 'primary' && 'bg-primary',
            tone === 'warning' && 'bg-warning',
            tone === 'success' && 'bg-success',
            tone === 'default' && 'bg-muted-foreground',
          )}
        />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning/15 text-[oklch(0.45_0.12_60)]',
  sample_collected: 'bg-accent text-accent-foreground',
  processing: 'bg-primary/12 text-primary',
  outsourced: 'bg-chart-5/12 text-brand-deep',
  in_progress: 'bg-primary/12 text-primary',
  completed: 'bg-success/15 text-[oklch(0.4_0.11_155)]',
  cancelled: 'bg-destructive/10 text-destructive',
  paid: 'bg-success/15 text-[oklch(0.4_0.11_155)]',
  partial: 'bg-warning/15 text-[oklch(0.45_0.12_60)]',
  unpaid: 'bg-destructive/10 text-destructive',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text =
    label ?? ITEM_STATUS_LABELS[status] ?? ORDER_STATUS_LABELS[status] ?? status.replace('_', ' ')
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap capitalize',
        STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {text}
    </span>
  )
}

export function paymentStatus(total: number, paid: number) {
  if (paid >= total && total > 0) return 'paid'
  if (paid > 0) return 'partial'
  return total === 0 ? 'paid' : 'unpaid'
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export const selectClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
