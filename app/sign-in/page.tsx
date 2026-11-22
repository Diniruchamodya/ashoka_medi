import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { hasAnyStaff } from '@/app/actions/auth'
import { BrandPanel } from '@/components/auth/brand-panel'
import { SignInForm } from '@/components/auth/sign-in-form'

export const metadata: Metadata = { title: 'Staff Sign In' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')

  const [{ setup }, staffExists] = await Promise.all([searchParams, hasAnyStaff()])

  return (
    <main className="flex min-h-dvh flex-col md:flex-row">
      <BrandPanel />
      <section className="flex flex-1 items-center justify-center px-6 py-12 md:max-w-lg md:px-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Staff sign in</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your Ashoka Medi-Lab staff account.
            </p>
          </div>
          <SignInForm
            notice={setup === 'done' ? 'Administrator account created. You can sign in now.' : undefined}
          />
          {!staffExists && (
            <p className="text-sm text-muted-foreground">
              First time here?{' '}
              <Link href="/setup" className="font-medium text-primary underline-offset-4 hover:underline">
                Create the administrator account
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
