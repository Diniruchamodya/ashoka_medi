import { validateSriLankanPhone } from '@/lib/phone-validation'

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizePhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, '')
  return compact.startsWith('+94') ? `0${compact.slice(3)}` : compact
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function validateOptionalPhone(value: string) {
  return value.trim() ? validateSriLankanPhone(value) : undefined
}

export function validateOptionalEmail(value: string) {
  const email = value.trim()
  if (!email) return undefined
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : 'Enter a valid email address.'
}
