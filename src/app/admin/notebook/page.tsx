import { NotebookOperationsClarity } from '@/components/notebook/notebook-operations-clarity'
import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'
import { notebookTranscriptionConfigured } from '@/lib/notebook/transcription-config'

export default function AdminNotebookPage() {
  return (
    <div className="dark min-h-dvh bg-espresso pb-24 text-champagne" data-notebook-workspace="admin">
      <NotebookOperationsClarity
        surface="admin"
        transcriptionConfigured={notebookTranscriptionConfigured()}
      />
      <NotebookWorkspace surface="admin" />
    </div>
  )
}
