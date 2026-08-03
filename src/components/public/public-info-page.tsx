import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'

export function PublicInfoPage({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  action?: { label: string; href: string }
}) {
  return (
    <PublicPlatformShell>
      <section className="bg-espresso px-4 py-16 text-champagne sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-champagne/65">{description}</p>
          {action && (
            <Link href={action.href} className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-espresso hover:bg-gold-light">
              {action.label}<ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">{children}</section>
    </PublicPlatformShell>
  )
}
