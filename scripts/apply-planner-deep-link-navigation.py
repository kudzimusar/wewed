from pathlib import Path

path = Path('src/components/wedding/import-export-bar.tsx')
source = path.read_text()


def replace_once(old: str, new: str) -> None:
    global source
    if new in source:
        return
    if old not in source:
        raise SystemExit(f'Missing expected source block:\n{old}')
    source = source.replace(old, new, 1)


replace_once(
    "import { worksheetPermissionCapabilities } from '@/lib/planner-client-permissions'",
    "import { worksheetPermissionCapabilities } from '@/lib/planner-client-permissions'\nimport type { PlannerToolSlug } from '@/lib/planner-route-state'",
)

replace_once(
    """interface ImportExportBarProps {
  moduleKey: string
  onImportComplete?: () => void
  className?: string
}""",
    """interface ImportExportBarProps {
  moduleKey: string
  routeTool?: PlannerToolSlug | null
  onRouteToolChange?: (tool: PlannerToolSlug | null) => void
  onImportComplete?: () => void
  className?: string
}""",
)

replace_once(
    """export function ImportExportBar({
  moduleKey,
  onImportComplete,
  className = '',
}: ImportExportBarProps) {""",
    """export function ImportExportBar({
  moduleKey,
  routeTool,
  onRouteToolChange,
  onImportComplete,
  className = '',
}: ImportExportBarProps) {""",
)

replace_once(
    """  const [importOpen, setImportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)""",
    """  const [localImportOpen, setLocalImportOpen] = useState(false)
  const [localHistoryOpen, setLocalHistoryOpen] = useState(false)
  const routeControlled = routeTool !== undefined
  const importOpen = routeControlled ? routeTool === 'import' : localImportOpen
  const historyOpen = routeControlled ? routeTool === 'imports' : localHistoryOpen""",
)

replace_once(
    """  useEffect(() => {
    const clearWorksheetState = () => {
      setJobs([])
      setHistoryOpen(false)
      setImportOpen(false)
    }
    window.addEventListener('wewed:wedding-switched', clearWorksheetState)
    return () => window.removeEventListener('wewed:wedding-switched', clearWorksheetState)
  }, [])""",
    """  useEffect(() => {
    const clearWorksheetState = () => {
      setJobs([])
      setLocalHistoryOpen(false)
      setLocalImportOpen(false)
      if (routeControlled) onRouteToolChange?.(null)
    }
    window.addEventListener('wewed:wedding-switched', clearWorksheetState)
    return () => window.removeEventListener('wewed:wedding-switched', clearWorksheetState)
  }, [onRouteToolChange, routeControlled])""",
)

replace_once(
    """  const handleImportComplete = useCallback(() => {
    onImportComplete?.()
    void loadHistory(false)
  }, [loadHistory, onImportComplete])

  const toggleHistory = useCallback(() => {
    setHistoryOpen((current) => {
      const next = !current
      if (next) void loadHistory()
      return next
    })
  }, [loadHistory])""",
    """  const setRouteTool = useCallback(
    (tool: PlannerToolSlug | null) => {
      if (routeControlled) {
        onRouteToolChange?.(tool)
        return
      }
      setLocalImportOpen(tool === 'import')
      setLocalHistoryOpen(tool === 'imports')
    },
    [onRouteToolChange, routeControlled],
  )

  const handleImportComplete = useCallback(() => {
    onImportComplete?.()
    void loadHistory(false)
  }, [loadHistory, onImportComplete])

  const toggleHistory = useCallback(() => {
    setRouteTool(historyOpen ? null : 'imports')
  }, [historyOpen, setRouteTool])

  useEffect(() => {
    if (historyOpen) void loadHistory(false)
  }, [historyOpen, loadHistory])""",
)

replace_once(
    "onClick={() => setImportOpen(true)}",
    "onClick={() => setRouteTool('import')}",
)

replace_once(
    "onClose={() => setImportOpen(false)}",
    "onClose={() => setRouteTool(null)}",
)

path.write_text(source)
print(f'Updated {path}')
