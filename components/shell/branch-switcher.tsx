'use client'

import { useTransition } from 'react'
import { Building2 } from 'lucide-react'
import { setActiveBranch } from '@/app/actions/auth'

type Branch = { id: number; name: string }

export function BranchSwitcher({
  branches,
  activeId,
  canSwitch,
}: {
  branches: Branch[]
  activeId: number
  canSwitch: boolean
}) {
  const [pending, startTransition] = useTransition()
  const active = branches.find((b) => b.id === activeId)

  if (!canSwitch || branches.length < 2) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="size-4 text-primary" aria-hidden />
        <span className="font-medium">{active?.name}</span>
      </div>
    )
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <Building2 className="size-4 text-primary" aria-hidden />
      <span className="sr-only">Selected branch</span>
      <select
        value={activeId}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData()
          fd.set('branchId', e.target.value)
          startTransition(() => setActiveBranch(fd))
        }}
        className="h-8 rounded-lg border border-input bg-background px-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}
