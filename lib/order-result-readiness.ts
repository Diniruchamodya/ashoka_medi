import type { OrderedTestResult } from '@/lib/db/schema'

export function hasStructuredReportResult(
  result: OrderedTestResult | null | undefined,
): result is OrderedTestResult {
  return Boolean(
    result &&
      Array.isArray(result.parameters) &&
      result.parameters.length > 0 &&
      result.parameters.every(
        (parameter) => typeof parameter.value === 'string' && parameter.value.trim().length > 0,
      ),
  )
}

export function hasLegacyReportResult(status: string, value: string | null | undefined) {
  const result = value?.trim()
  return status === 'completed' && Boolean(result && result.toLowerCase() !== 'completed')
}

export function hasReadyReport(
  status: string,
  legacyResult: string | null | undefined,
  resultData: OrderedTestResult | null | undefined,
) {
  return hasStructuredReportResult(resultData) || hasLegacyReportResult(status, legacyResult)
}
