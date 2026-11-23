import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import {
  authenticateWithRateLimit,
  getTrustedClientIp,
  SignInRateLimitUnavailable,
} from '@/lib/sign-in-rate-limit'

const handlers = toNextJsHandler(auth)

export const GET = handlers.GET

async function postAuthHandler(request: Request) {
  const response = await handlers.POST(request)
  if (response.status >= 500) {
    console.error('[sign-in] auth handler returned server error', {
      step: 'better_auth_response',
      code: `HTTP_${response.status}`,
    })
  }
  return response
}

export async function POST(request: Request) {
  if (new URL(request.url).pathname !== '/api/auth/sign-in/email') {
    return postAuthHandler(request)
  }

  const clientIp = getTrustedClientIp(request)
  if (!clientIp) {
    console.error('[sign-in-rate-limit] unavailable', {
      step: 'resolve_client_ip',
      code: 'TRUSTED_IP_UNAVAILABLE',
    })
    return Response.json(
      { code: 'SERVICE_UNAVAILABLE', message: 'Sign-in is temporarily unavailable. Please try again.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    return postAuthHandler(request)
  }
  const email =
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof body.email === 'string'
      ? body.email
      : ''

  try {
    return await authenticateWithRateLimit(email, clientIp, () => postAuthHandler(request))
  } catch (error) {
    if (error instanceof SignInRateLimitUnavailable) {
      console.error('[sign-in-rate-limit] unavailable', {
        step: error.step,
        code: error.code,
      })
      return Response.json(
        { code: 'SERVICE_UNAVAILABLE', message: error.message },
        { status: 503 },
      )
    }
    throw error
  }
}
