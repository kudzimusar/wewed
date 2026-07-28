'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, PencilLine, Eye } from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { isAdminLoggedIn } from '@/lib/admin-auth'

/* ============================================================
   EditModeToggle — Navbar control that flips the site into
   "edit mode" so admins can inline-edit content sections.
   ------------------------------------------------------------
   • Renders only when an admin is logged in (isAdminLoggedIn()).
   • Reads + writes `editMode` from the zustand store (persisted).
   • The toggle is a slim pill-button matching the navbar's
     LanguageToggle/BeforeAfterToggle/ThemeToggle family.
   • Edit-mode on  → pencil icon turns gold, all ContentEditor
                     wrappers show their floating pencil button.
   • Edit-mode off → pencil icon is muted; the site reads as
                     a normal guest sees it.
   ============================================================ */

export function EditModeToggle() {
  const editMode = useWewedStore((s) => s.editMode)
  const setEditMode = useWewedStore((s) => s.setEditMode)
  const toggleEditMode = useWewedStore((s) => s.toggleEditMode)
  const [admin, setAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client mount flag, no cascading render
    setMounted(true)
    setAdmin(isAdminLoggedIn())
    // Re-check on focus (e.g. after login in another tab)
    const onFocus = () => setAdmin(isAdminLoggedIn())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (!mounted || !admin) return null

  return (
    <button
      type="button"
      onClick={toggleEditMode}
      aria-pressed={editMode}
      aria-label={editMode ? 'Exit edit mode' : 'Enter edit mode'}
      title={editMode ? 'Edit mode is ON — click to exit' : 'Edit mode is OFF — click to start editing'}
      className={`group relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur-sm transition-colors ${
        editMode
          ? 'border-gold bg-gold/20 text-gold shadow-[0_0_0_1px_rgba(191,155,95,0.4)]'
          : 'border-gold/30 bg-espresso/40 text-champagne/70 hover:bg-gold/10 hover:text-gold'
      }`}
    >
      <motion.span
        key={editMode ? 'on' : 'off'}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="inline-flex"
      >
        {editMode ? <PencilLine className="size-3.5" /> : <Pencil className="size-3.5" />}
      </motion.span>
      <span className="hidden font-sans text-[10px] font-semibold uppercase tracking-[0.18em] sm:inline">
        {editMode ? 'Editing' : 'Edit'}
      </span>
      {editMode && (
        <motion.span
          layoutId="edit-mode-pulse"
          className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-gold"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      <span className="sr-only">
        {editMode
          ? 'Edit mode active. Editable sections show a pencil button.'
          : 'Edit mode inactive.'}
      </span>
    </button>
  )
}

/**
 * A compact icon-only variant — useful for crowded toolbars (e.g.
 * the planner header) where a labelled pill won't fit. Same visibility
 * rules: hidden when no admin session is present.
 */
export function EditModeToggleCompact() {
  const editMode = useWewedStore((s) => s.editMode)
  const toggleEditMode = useWewedStore((s) => s.toggleEditMode)
  const [admin, setAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client mount flag
    setMounted(true)
    setAdmin(isAdminLoggedIn())
    const onFocus = () => setAdmin(isAdminLoggedIn())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (!mounted || !admin) return null

  return (
    <button
      type="button"
      onClick={toggleEditMode}
      aria-pressed={editMode}
      aria-label={editMode ? 'Exit edit mode' : 'Enter edit mode'}
      title={
        editMode
          ? 'Edit mode ON — click to exit'
          : 'Edit mode OFF — click to start editing'
      }
      className={`inline-flex size-9 items-center justify-center rounded-full border transition-colors ${
        editMode
          ? 'border-gold bg-gold/20 text-gold'
          : 'border-gold/30 bg-espresso/40 text-champagne/70 hover:bg-gold/10 hover:text-gold'
      }`}
    >
      {editMode ? <PencilLine className="size-4" /> : <Eye className="size-4" />}
    </button>
  )
}
