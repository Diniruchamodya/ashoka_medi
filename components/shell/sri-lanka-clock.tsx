'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

export function SriLankaClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm" aria-label="Sri Lanka time">
      <Clock className="size-4 text-primary" aria-hidden />
      <div className="flex flex-col leading-tight">
        <time className="font-mono font-medium tabular-nums" suppressHydrationWarning>
          {now ? timeFmt.format(now) : '--:--:-- --'}
        </time>
        <span className="text-xs text-muted-foreground">
          {now ? dateFmt.format(now) : '\u00a0'} · Sri Lanka
        </span>
      </div>
    </div>
  )
}
