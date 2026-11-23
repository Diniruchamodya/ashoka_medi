import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import type { PoolClient } from '@neondatabase/serverless'
import { rateLimitPool } from '@/lib/db'

type RateLimitClient = PoolClient

const MAX_FAILURES = 5
const FAILURE_WINDOW_MINUTES = 5
const COOLDOWN_MINUTES = 5
const TOO_MANY_PREFIX = 'Too many sign-in attempts. Try again in '

export class SignInRateLimitUnavailable extends Error {
  constructor(
    readonly step: string,
    readonly code: string,
  ) {
    super('Sign-in is temporarily unavailable. Please try again.')
  }
}

function safeErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{1,32}$/.test(error.code)
  ) {
    return error.code
  }
  return 'UNKNOWN'
}

function rateLimitError(step: string, error: unknown) {
  return new SignInRateLimitUnavailable(step, safeErrorCode(error))
}

function hashKey(scope: string, value: string) {
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === 'development' ? 'ashoka-local-sign-in-rate-limit' : null)
  if (!secret) throw new SignInRateLimitUnavailable('rate_limit_secret', 'MISSING_SECRET')
  return createHmac('sha256', secret).update(`${scope}\0${value}`).digest('hex')
}

function normalizeIp(ip: string) {
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip
}

export function getTrustedClientIp(request: Request): string | null {
  if (process.env.VERCEL === '1') {
    const forwarded =
      request.headers.get('x-vercel-forwarded-for') ??
      request.headers.get('x-forwarded-for')
    const address = forwarded?.split(',')[0]?.trim()
    return address && isIP(address) ? normalizeIp(address) : null
  }

  return process.env.NODE_ENV === 'development' ? '127.0.0.1' : null
}

function rateLimitResponse(remainingMs: number) {
  const totalSeconds = Math.max(1, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const remainingTime = minutes === 0
    ? `${seconds} second${seconds === 1 ? '' : 's'}`
    : seconds === 0
      ? `${minutes} minute${minutes === 1 ? '' : 's'}`
      : `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
  const message = `${TOO_MANY_PREFIX}${remainingTime}.`
  return Response.json(
    { code: 'TOO_MANY_REQUESTS', message },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(remainingMs / 1000))) },
    },
  )
}

async function clearFailures(
  client: RateLimitClient,
  pairHash: string,
) {
  await client.query(
    `DELETE FROM sign_in_rate_limits
     WHERE "scope" = 'email_ip' AND "keyHash" = $1`,
    [pairHash],
  )
}

async function clearExpiredFailures(
  client: RateLimitClient,
  pairHash: string,
  ipHash: string,
) {
  await client.query(
    `DELETE FROM sign_in_rate_limits
     WHERE (("scope" = 'email_ip' AND "keyHash" = $1)
       OR ("scope" = 'ip' AND "keyHash" = $2))
       AND (
         "lockedUntil" <= statement_timestamp()
         OR (
           "lockedUntil" IS NULL
             AND "windowStartedAt" <= statement_timestamp() - ($3::double precision * interval '1 minute')
         )
       )`,
    [pairHash, ipHash, FAILURE_WINDOW_MINUTES],
  )
}

async function incrementFailure(
  client: RateLimitClient,
  scope: 'email_ip' | 'ip',
  keyHash: string,
) {
  const result = await client.query<{ failureCount: number; lockedUntil: Date | null }>(
    `INSERT INTO sign_in_rate_limits ("scope", "keyHash", "failureCount", "windowStartedAt", "updatedAt")
     VALUES ($1, $2, 1, statement_timestamp(), statement_timestamp())
     ON CONFLICT ("scope", "keyHash") DO UPDATE SET
       "failureCount" = CASE
         WHEN sign_in_rate_limits."windowStartedAt" <= statement_timestamp() - ($4::double precision * interval '1 minute')
           OR sign_in_rate_limits."lockedUntil" <= statement_timestamp()
         THEN 1
         ELSE sign_in_rate_limits."failureCount" + 1
       END,
       "windowStartedAt" = CASE
         WHEN sign_in_rate_limits."windowStartedAt" <= statement_timestamp() - ($4::double precision * interval '1 minute')
           OR sign_in_rate_limits."lockedUntil" <= statement_timestamp()
         THEN statement_timestamp()
         ELSE sign_in_rate_limits."windowStartedAt"
       END,
       "lockedUntil" = CASE
         WHEN sign_in_rate_limits."windowStartedAt" <= statement_timestamp() - ($4::double precision * interval '1 minute')
           OR sign_in_rate_limits."lockedUntil" <= statement_timestamp()
         THEN NULL
         WHEN sign_in_rate_limits."failureCount" + 1 >= $3
         THEN statement_timestamp() + ($5::double precision * interval '1 minute')
         ELSE NULL
       END,
       "updatedAt" = statement_timestamp()
     RETURNING "failureCount", "lockedUntil"`,
    [scope, keyHash, MAX_FAILURES, FAILURE_WINDOW_MINUTES, COOLDOWN_MINUTES],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Sign-in rate-limit counter update returned no row.')
  return row
}

async function recordFailure(
  client: RateLimitClient,
  pairHash: string,
  ipHash: string,
) {
  await incrementFailure(client, 'email_ip', pairHash)
  await incrementFailure(client, 'ip', ipHash)
}

async function lockedRemainingMs(
  client: RateLimitClient,
  pairHash: string,
  ipHash: string,
) {
  const result = await client.query<{ remainingMs: number }>(
    `SELECT GREATEST(
       0,
       EXTRACT(EPOCH FROM ("lockedUntil" - statement_timestamp())) * 1000
     )::double precision AS "remainingMs"
     FROM sign_in_rate_limits
     WHERE "lockedUntil" > statement_timestamp()
       AND (("scope" = 'email_ip' AND "keyHash" = $1)
         OR ("scope" = 'ip' AND "keyHash" = $2))`,
    [pairHash, ipHash],
  )
  return Math.max(0, ...result.rows.map((row) => row.remainingMs))
}

async function rollback(
  client: RateLimitClient,
  transactionOpen: boolean,
) {
  if (!transactionOpen) return
  try {
    await client.query('ROLLBACK')
  } catch (error) {
    throw rateLimitError('rollback', error)
  }
}

export async function authenticateWithRateLimit(
  email: string,
  clientIp: string,
  authenticate: () => Promise<Response>,
): Promise<Response> {
  const normalizedEmail = email.trim().toLowerCase()
  const pairHash = hashKey('email_ip', `${normalizedEmail}\0${clientIp}`)
  const ipHash = hashKey('ip', clientIp)
  const lockHash = hashKey('ip_lock', clientIp)
  let client: RateLimitClient
  try {
    client = await rateLimitPool.connect()
  } catch (error) {
    throw rateLimitError('database_connect', error)
  }
  let transactionOpen = false

  try {
    let remainingMs: number
    let counterStep = 'begin_transaction'
    try {
      await client.query('BEGIN')
      transactionOpen = true
      counterStep = 'acquire_ip_lock'
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockHash])
      counterStep = 'prune_old_limits'
      await client.query(
        `WITH expired AS (
           SELECT "scope", "keyHash"
           FROM sign_in_rate_limits
           WHERE "updatedAt" < statement_timestamp() - interval '1 day'
           ORDER BY "updatedAt"
           LIMIT 100
           FOR UPDATE SKIP LOCKED
         )
         DELETE FROM sign_in_rate_limits AS limits
         USING expired
         WHERE limits."scope" = expired."scope"
           AND limits."keyHash" = expired."keyHash"`,
      )
      counterStep = 'reset_expired_counter'
      await clearExpiredFailures(client, pairHash, ipHash)
      counterStep = 'check_cooldown'
      remainingMs = await lockedRemainingMs(client, pairHash, ipHash)
    } catch (error) {
      await rollback(client, transactionOpen)
      throw rateLimitError(counterStep, error)
    }

    if (remainingMs > 0) {
      try {
        await client.query('COMMIT')
        transactionOpen = false
      } catch (error) {
        await rollback(client, transactionOpen)
        throw rateLimitError('commit_blocked_attempt', error)
      }
      return rateLimitResponse(remainingMs)
    }

    let response: Response
    try {
      response = await authenticate()
    } catch (error) {
      await rollback(client, transactionOpen)
      throw rateLimitError('authenticate', error)
    }

    let authStep = 'record_failure'
    try {
      if (response.status === 401) {
        await recordFailure(client, pairHash, ipHash)
        authStep = 'check_cooldown_after_failure'
        remainingMs = await lockedRemainingMs(client, pairHash, ipHash)
        authStep = 'commit_failure'
        await client.query('COMMIT')
        transactionOpen = false
        return remainingMs > 0 ? rateLimitResponse(remainingMs) : response
      }
      if (response.ok) {
        authStep = 'clear_successful_email_counter'
        await clearFailures(client, pairHash)
      }
      authStep = 'commit_authentication'
      await client.query('COMMIT')
      transactionOpen = false
      return response
    } catch (error) {
      await rollback(client, transactionOpen)
      throw rateLimitError(authStep, error)
    }
  } finally {
    client.release()
  }
}
