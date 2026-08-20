import { NotebookLiveTranscriptionBridge, type NotebookTranscriptionMode } from '@/components/notebook/notebook-live-transcription-bridge'
import { NotebookOperationsClarity } from '@/components/notebook/notebook-operations-clarity'
import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'
import { resolveNotebookTranscriptionConfig } from '@/lib/notebook/transcription-config'

export default function PlannerNotebookPage() {
  const config = resolveNotebookTranscriptionConfig()
  const mode: NotebookTranscriptionMode = !config ? 'none' : config.requestShape === 'zai' ? 'live-chunks' : 'direct'

  return (
    <div data-notebook-workspace="planner">
      <NotebookLiveTranscriptionBridge mode={mode} />
      <NotebookOperationsClarity
        surface="planner"
        transcriptionConfigured={Boolean(config)}
      />
      <NotebookWorkspace surface="planner" />
    </div>
  )
}
