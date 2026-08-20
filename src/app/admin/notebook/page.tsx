import { NotebookLiveTranscriptionBridge, type NotebookTranscriptionMode } from '@/components/notebook/notebook-live-transcription-bridge'
import { NotebookOperationsClarity } from '@/components/notebook/notebook-operations-clarity'
import { NotebookWorkspace } from '@/components/notebook/notebook-workspace'
import { resolveNotebookTranscriptionConfig } from '@/lib/notebook/transcription-config'

export default function AdminNotebookPage() {
  const config = resolveNotebookTranscriptionConfig()
  const mode: NotebookTranscriptionMode = !config ? 'none' : config.requestShape === 'zai' ? 'live-chunks' : 'direct'

  return (
    <div className="dark min-h-dvh bg-espresso pb-24 text-champagne" data-notebook-workspace="admin">
      <NotebookLiveTranscriptionBridge mode={mode} />
      <NotebookOperationsClarity
        surface="admin"
        transcriptionConfigured={Boolean(config)}
      />
      <NotebookWorkspace surface="admin" />
    </div>
  )
}
