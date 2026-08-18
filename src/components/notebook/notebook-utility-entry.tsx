'use client'

import { usePathname } from 'next/navigation'
import { NotebookPen } from 'lucide-react'
import { NotebookQuickCapture } from './notebook-quick-capture'

export function NotebookUtilityEntry({ surface }: { surface: 'planner' | 'admin' }) {
  const pathname = usePathname()
  const href = surface === 'planner' ? '/planner/notebook' : '/admin/notebook'
  const onNotebook = pathname.startsWith(href)

  if (surface === 'planner') {
    return (
      <div data-planner-notebook-host className="contents">
        <NotebookQuickCapture surface="planner" showTrigger={false} />
      </div>
    )
  }

  return (
    <>
      {!onNotebook && (
        <a
          href={href}
          className="fixed bottom-20 right-[4.5rem] z-[57] flex min-h-12 min-w-12 items-center justify-center rounded-full border border-gold/25 bg-espresso text-gold shadow-2xl hover:bg-gold/10 md:bottom-6 md:right-[9.5rem]"
          aria-label="Open Notebook"
          title="Open Notebook"
        >
          <NotebookPen className="size-4" />
        </a>
      )}
      <NotebookQuickCapture surface="admin" />
    </>
  )
}
