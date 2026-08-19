'use client'

import { useEffect } from 'react'

export function NotebookRecoveryAnchor() {
  useEffect(() => {
    if (window.location.hash !== '#recovery') return
    let attempts = 0
    const focusRecovery = () => {
      attempts += 1
      const heading = Array.from(document.querySelectorAll('h2')).find((item) => item.textContent?.trim() === 'Recovery')
      const section = heading?.closest('section')
      if (section) {
        section.setAttribute('data-notebook-recovery-section', 'true')
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (attempts < 20) window.setTimeout(focusRecovery, 100)
    }
    focusRecovery()
  }, [])

  return null
}
