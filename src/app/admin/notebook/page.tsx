import { NotebookOperationsClarity } from '@/components/notebook/notebook-operations-clarity'
import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'

export default function AdminNotebookPage() {
  return (
    <div className="dark min-h-dvh bg-espresso pb-24 text-champagne" data-notebook-workspace="admin">
      <NotebookOperationsClarity
        surface="admin"
        transcriptionConfigured={Boolean(process.env.WEWED_TRANSCRIPTION_URL?.trim())}
      />
      <NotebookWorkspace surface="admin" />
    </div>
  )
}
