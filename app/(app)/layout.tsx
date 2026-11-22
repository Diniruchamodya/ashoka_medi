import { requireStaff } from '@/lib/staff'
import { AppHeader } from '@/components/shell/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        userName={staff.user.name}
        role={staff.profile.role}
        branches={staff.branches.map((b) => ({ id: b.id, name: b.name }))}
        activeBranchId={staff.activeBranch.id}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  )
}
