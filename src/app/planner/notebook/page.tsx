import { NotebookOperationsClarity } from '@/components/notebook/notebook-operations-clarity'
import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'
import { notebookTranscriptionConfigured } from '@/lib/notebook/transcription-config'

export default function PlannerNotebookPage() {
  return (
    <div data-notebook-workspace="planner">
      <NotebookOperationsClarity
        surface="planner"
        transcriptionConfigured={notebookTranscriptionConfigured()}
      />
      <NotebookWorkspace surface="planner" />
    </div>
  )
}
