import { NotebookOperationsClarity } from '@/components/notebook/notebook-operations-clarity'
import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'

export default function PlannerNotebookPage() {
  return (
    <div data-notebook-workspace="planner">
      <NotebookOperationsClarity
        surface="planner"
        transcriptionConfigured={Boolean(process.env.WEWED_TRANSCRIPTION_URL?.trim())}
      />
      <NotebookWorkspace surface="planner" />
    </div>
  )
}
