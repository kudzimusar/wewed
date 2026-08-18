import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'

export default function AdminNotebookPage() {
  return (
    <div className="dark min-h-dvh bg-espresso text-champagne pb-24">
      <NotebookWorkspace surface="admin" />
    </div>
  )
}
