import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { hasAnyStaff } from '@/app/actions/auth'
import { BrandPanel } from '@/components/auth/brand-panel'
import { SetupForm } from '@/components/auth/setup-form'

export const metadata: Metadata = { title: 'First-time Setup' }

export default async function SetupPage() {
  if (await hasAnyStaff()) redirect('/sign-in')

  return (
    <main className="flex min-h-dvh flex-col md:flex-row">
      <BrandPanel />
      <section className="flex flex-1 items-center justify-center px-6 py-12 md:max-w-lg md:px-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Create administrator</h1>
            <p className="text-sm text-muted-foreground">
              This one-time step creates the first administrator. Add other staff from the Staff
              page afterwards.
            </p>
          </div>
          <SetupForm />
        </div>
      </section>
    </main>
  )
}
