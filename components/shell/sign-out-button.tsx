'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onClick() {
    setPending(true)
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending} aria-label="Sign out">
      <LogOut aria-hidden />
      <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>Sign Out</span>
    </Button>
  )
}
