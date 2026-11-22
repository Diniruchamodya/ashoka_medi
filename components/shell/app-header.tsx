import Image from 'next/image'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { can, NAV_ITEMS, ROLE_LABELS, isRole } from '@/lib/permissions'
import { BranchSwitcher } from './branch-switcher'
import { MainNav } from './main-nav'
import { SignOutButton } from './sign-out-button'
import { SriLankaClock } from './sri-lanka-clock'

export function AppHeader({
  userName,
  role,
  branches,
  activeBranchId,
}: {
  userName: string
  role: string
  branches: { id: number; name: string }[]
  activeBranchId: number
}) {
  const items = NAV_ITEMS.filter((item) => can(role, item.permission))

  return (
    <header className="sticky top-0 z-40 bg-card/95 shadow-xs backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/ashoka-logo.jpg"
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-lg"
          />
          <span className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">Ashoka Medi-Lab</span>
            <span className="text-xs text-muted-foreground">Laboratory Management</span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <BranchSwitcher
            branches={branches}
            activeId={activeBranchId}
            canSwitch={can(role, 'branches.switch')}
          />
          <div className="hidden sm:block">
            <SriLankaClock />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <UserRound className="size-4 text-primary" aria-hidden />
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{userName}</span>
              <span className="text-xs text-muted-foreground">
                {isRole(role) ? ROLE_LABELS[role] : role}
              </span>
            </span>
          </div>
          <SignOutButton compact />
        </div>
      </div>
      <MainNav items={items.map(({ href, label }) => ({ href, label }))} />
    </header>
  )
}
