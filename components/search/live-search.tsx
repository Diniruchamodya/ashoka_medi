'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'

type LiveSearchContextValue = {
  name: string
  value: string
  setValue: (value: string) => void
}

const LiveSearchContext = createContext<LiveSearchContextValue | null>(null)

export function LiveSearch({
  name,
  initialValue,
  children,
}: {
  name: string
  initialValue: string
  children: React.ReactNode
}) {
  const [value, setValue] = useState(initialValue)
  const latestValue = useRef(value)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    latestValue.current = value
  }, [value])

  useEffect(() => {
    const query = value.trim()
    const currentParams = new URLSearchParams(window.location.search)
    if ((currentParams.get(name) ?? '') === query) return

    const timeout = window.setTimeout(() => {
      if (latestValue.current.trim() !== query) return
      const params = new URLSearchParams(window.location.search)
      if (query) params.set(name, query)
      else params.delete(name)
      params.delete('page')
      const search = params.toString()
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [name, pathname, router, value])

  return (
    <LiveSearchContext.Provider value={{ name, value, setValue }}>
      {children}
    </LiveSearchContext.Provider>
  )
}

export function LiveSearchInput({
  placeholder,
  ariaLabel,
  className,
}: {
  placeholder: string
  ariaLabel: string
  className?: string
}) {
  const search = useContext(LiveSearchContext)
  if (!search) throw new Error('LiveSearchInput must be inside LiveSearch.')

  return (
    <Input
      type="search"
      name={search.name}
      value={search.value}
      onChange={(event) => search.setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  )
}

export function LiveSearchResults({
  query,
  children,
}: {
  query: string
  children: React.ReactNode
}) {
  const search = useContext(LiveSearchContext)
  if (!search) throw new Error('LiveSearchResults must be inside LiveSearch.')
  if (search.value.trim() !== query.trim()) {
    return <p className="text-sm text-muted-foreground" aria-live="polite">Updating results…</p>
  }
  return children
}
