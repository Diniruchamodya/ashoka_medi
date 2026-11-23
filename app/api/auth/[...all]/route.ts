import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import {
  authenticateWithRateLimit,
  getTrustedClientIp,
  SignInRateLimitUnavailable,
} from '@/lib/sign-in-rate-limit'

const handlers = toNextJsHandler(auth)

export const GET = handlers.GET

export async function POST(request: Request) {
  if (new URL(request.url).pathname !== '/api/auth/sign-in/email') {
    return handlers.POST(request)
  }

  const clientIp = getTrustedClientIp(request)
  if (!clientIp) {
    return Response.json(
      { code: 'SERVICE_UNAVAILABLE', message: 'Sign-in is temporarily unavailable. Please try again.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    return handlers.POST(request)
  }
  const email =
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof body.email === 'string'
      ? body.email
      : ''

  try {
    return await authenticateWithRateLimit(email, clientIp, () => handlers.POST(request))
  } catch (error) {
    if (error instanceof SignInRateLimitUnavailable) {
      return Response.json(
        { code: 'SERVICE_UNAVAILABLE', message: error.message },
        { status: 503 },
      )
    }
    throw error
  }
}
