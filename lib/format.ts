import { sql, type AnyColumn } from 'drizzle-orm'

export const TIME_ZONE = 'Asia/Colombo'

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  minimumFractionDigits: 2,
})

export function formatLKR(value: string | number | null | undefined) {
  return lkr.format(Number(value ?? 0))
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

// Timestamps are stored as UTC without a zone, so treat them as UTC on read.
function toDate(value: Date | string) {
  if (value instanceof Date) return value
  return new Date(value.endsWith('Z') ? value : `${value}Z`)
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '—'
  return dateTimeFmt.format(toDate(value))
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—'
  return dateFmt.format(toDate(value))
}

export function colomboDate(column: AnyColumn) {
  return sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE})::date`
}

export const colomboToday = sql`(now() AT TIME ZONE ${TIME_ZONE})::date`

export function todayInColombo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

export function daysAgoInColombo(days: number) {
  const d = new Date(Date.now() - days * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d)
}

export function ageFrom(dob: string | null) {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}
