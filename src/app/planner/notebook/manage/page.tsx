import { NotebookManagement } from '@/components/notebook/notebook-management'
import { NotebookRecoveryAnchor } from '@/components/notebook/notebook-recovery-anchor'

export default function PlannerNotebookManagePage() {
  return (
    <div id="recovery" className="scroll-mt-4">
      <NotebookRecoveryAnchor />
      <NotebookManagement surface="planner" />
    </div>
  )
}
