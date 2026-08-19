import { NotebookManagement } from '@/components/notebook/notebook-management'
import { NotebookRecoveryAnchor } from '@/components/notebook/notebook-recovery-anchor'

export default function AdminNotebookManagePage() {
  return (
    <div id="recovery" className="scroll-mt-4">
      <NotebookRecoveryAnchor />
      <NotebookManagement surface="admin" />
    </div>
  )
}
