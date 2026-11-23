const SRI_LANKAN_LANDLINE_AREA_CODES =
  '(?:11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91)'

export function validateSriLankanPhone(value: string): string | undefined {
  if (!value.trim()) return 'Phone is required.'
  if (!/^\+?[0-9 ()-]+$/.test(value)) {
    return 'Use digits, spaces, hyphens, parentheses, and an optional + at the beginning.'
  }

  const digits = value.replace(/[ ()-]/g, '')
  const digitCount = digits.replace(/\D/g, '').length
  if (digitCount < 7 || digitCount > 15) {
    return 'Phone number must contain 7 to 15 digits.'
  }

  if (
    /^07\d{8}$/.test(digits) ||
    new RegExp(`^0${SRI_LANKAN_LANDLINE_AREA_CODES}\\d{7}$`).test(digits) ||
    /^\+94\d{9}$/.test(digits)
  ) {
    return undefined
  }

  return 'Enter a valid Sri Lankan mobile, landline, or +94 phone number.'
}
