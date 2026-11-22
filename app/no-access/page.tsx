import { redirect } from 'next/navigation'
import { getStaffContext } from '@/lib/staff'
import { SignOutButton } from '@/components/shell/sign-out-button'

export default async function NoAccessPage() {
  const ctx = await getStaffContext()
  if (!ctx) redirect('/sign-in')
  if (ctx.profile && ctx.activeBranch) redirect('/')

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">Access not available</h1>
        <p className="text-muted-foreground">
          Your account ({ctx.user.email}) is not active or has no branch assigned. Ask an
          administrator to update your staff access.
        </p>
        <SignOutButton />
      </div>
    </main>
  )
}
