import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'

export default function PlannerNotebookPage() {
  return (
    <>
      <a href="/planner/notebook/manage" className="fixed right-3 top-3 z-[55] rounded-xl border border-gold/25 bg-espresso/95 px-3 py-2 text-xs font-semibold text-gold shadow-xl backdrop-blur hover:bg-gold/10 md:right-5 md:top-5">
        Files · tags · recovery
      </a>
      <NotebookWorkspace surface="planner" />
    </>
  )
}
