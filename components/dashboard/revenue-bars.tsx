import { formatLKR } from '@/lib/format'

export function RevenueBars({ days }: { days: { day: string; total: number }[] }) {
  const max = Math.max(...days.map((d) => d.total), 1)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex h-36 items-end gap-2" aria-label="Daily collections">
        {days.map((d) => {
          const label = new Date(`${d.day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })
          return (
            <li key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span
                className="w-full rounded-t-md bg-primary/80"
                style={{ height: `${Math.max((d.total / max) * 100, 2)}%` }}
                title={`${d.day}: ${formatLKR(d.total)}`}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="sr-only">{formatLKR(d.total)}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        Total <span className="font-medium text-foreground tabular-nums">{formatLKR(days.reduce((s, d) => s + d.total, 0))}</span>
      </p>
    </div>
  )
}
