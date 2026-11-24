'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignInForm({ notice }: { notice?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { error } = await authClient.signIn.email({
      email,
      password: String(form.get('password')),
    })
    if (error) {
      const isRateLimited = error.status === 429 && error.code === 'TOO_MANY_REQUESTS'
      const isUnavailable = error.status === 503 && error.code === 'SERVICE_UNAVAILABLE'
      setError(
        isRateLimited || isUnavailable
          ? error.message ?? 'Sign-in is temporarily unavailable.'
          : 'Invalid email or password.',
      )
      setPending(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {notice && (
        <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground" role="status">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-10"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="h-10 pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-10">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Sign in
      </Button>
    </form>
  )
}
