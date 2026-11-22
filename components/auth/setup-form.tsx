'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { createInitialAdmin } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SetupForm() {
  const [state, action, pending] = useActionState(createInitialAdmin, undefined)

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required autoComplete="name" className="h-10" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-10">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Create administrator
      </Button>
    </form>
  )
}
