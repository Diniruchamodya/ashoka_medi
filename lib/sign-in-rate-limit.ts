import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import type { PoolClient } from '@neondatabase/serverless'
import { rateLimitPool } from '@/lib/db'

type RateLimitClient = PoolClient

const MAX_FAILURES = 5
const FAILURE_WINDOW_MINUTES = 5
const COOLDOWN_MINUTES = 5
const TOO_MANY_PREFIX = 'Too many sign-in attempts. Please try again in '
const FIRST_LIMIT_MESSAGE = `${TOO_MANY_PREFIX}${COOLDOWN_MINUTES} minutes`

export class SignInRateLimitUnavailable extends Error {
  constructor() {
    super('Sign-in is temporarily unavailable. Please try again.')
  }
}

function hashKey(scope: string, value: string) {
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === 'development' ? 'ashoka-local-sign-in-rate-limit' : null)
  if (!secret) throw new SignInRateLimitUnavailable()
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

function rateLimitResponse(remainingMs: number, firstReached = false) {
  let message = FIRST_LIMIT_MESSAGE
  if (!firstReached) {
    if (remainingMs >= 60_000) {
      const minutes = Math.ceil(remainingMs / 60_000)
      message = `${TOO_MANY_PREFIX}${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    } else {
      const seconds = Math.max(1, Math.ceil(remainingMs / 1000))
      message = `${TOO_MANY_PREFIX}${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
    }
  }
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
         WHEN sign_in_rate_limits."windowStartedAt" <= statement_timestamp() - ($4 * interval '1 minute')
           OR sign_in_rate_limits."lockedUntil" <= statement_timestamp()
         THEN 1
         ELSE sign_in_rate_limits."failureCount" + 1
       END,
       "windowStartedAt" = CASE
         WHEN sign_in_rate_limits."windowStartedAt" <= statement_timestamp() - ($4 * interval '1 minute')
           OR sign_in_rate_limits."lockedUntil" <= statement_timestamp()
         THEN statement_timestamp()
         ELSE sign_in_rate_limits."windowStartedAt"
       END,
       "lockedUntil" = CASE
         WHEN sign_in_rate_limits."windowStartedAt" <= statement_timestamp() - ($4 * interval '1 minute')
           OR sign_in_rate_limits."lockedUntil" <= statement_timestamp()
         THEN NULL
         WHEN sign_in_rate_limits."failureCount" + 1 >= $3
         THEN statement_timestamp() + ($5 * interval '1 minute')
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
  const pair = await incrementFailure(client, 'email_ip', pairHash)
  const ip = await incrementFailure(client, 'ip', ipHash)
  return pair.failureCount >= MAX_FAILURES || ip.failureCount >= MAX_FAILURES
}

async function lockedRemainingMs(
  client: RateLimitClient,
  pairHash: string,
  ipHash: string,
) {
  const result = await client.query<{ lockedUntil: Date }>(
    `SELECT "lockedUntil"
     FROM sign_in_rate_limits
     WHERE "lockedUntil" > statement_timestamp()
       AND (("scope" = 'email_ip' AND "keyHash" = $1)
         OR ("scope" = 'ip' AND "keyHash" = $2))`,
    [pairHash, ipHash],
  )
  const now = Date.now()
  return Math.max(
    0,
    ...result.rows.map((row) => row.lockedUntil.getTime() - now),
  )
}

async function rollback(
  client: RateLimitClient,
  transactionOpen: boolean,
) {
  if (!transactionOpen) return
  try {
    await client.query('ROLLBACK')
  } catch {
    throw new SignInRateLimitUnavailable()
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
  } catch {
    throw new SignInRateLimitUnavailable()
  }
  let transactionOpen = false

  try {
    let remainingMs: number
    try {
      await client.query('BEGIN')
      transactionOpen = true
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockHash])
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
      remainingMs = await lockedRemainingMs(client, pairHash, ipHash)
    } catch {
      await rollback(client, transactionOpen)
      throw new SignInRateLimitUnavailable()
    }

    if (remainingMs > 0) {
      try {
        await client.query('COMMIT')
        transactionOpen = false
      } catch {
        await rollback(client, transactionOpen)
        throw new SignInRateLimitUnavailable()
      }
      return rateLimitResponse(remainingMs)
    }

    let response: Response
    try {
      response = await authenticate()
    } catch (error) {
      await rollback(client, transactionOpen)
      throw error
    }

    try {
      if (response.status === 401) {
        const limitReached = await recordFailure(client, pairHash, ipHash)
        await client.query('COMMIT')
        transactionOpen = false
        return limitReached ? rateLimitResponse(COOLDOWN_MINUTES * 60_000, true) : response
      }
      if (response.ok) await clearFailures(client, pairHash)
      await client.query('COMMIT')
      transactionOpen = false
      return response
    } catch {
      await rollback(client, transactionOpen)
      throw new SignInRateLimitUnavailable()
    }
  } finally {
    client.release()
  }
}
