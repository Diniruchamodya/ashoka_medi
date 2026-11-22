'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Item = { href: string; label: string }

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  if (href === '/orders') return pathname === '/orders' || /^\/orders\/\d+/.test(pathname)
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MainNav({ items }: { items: Item[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="border-t border-border">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-6">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
