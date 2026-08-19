'use client'

import { useEffect } from 'react'

type Surface = 'planner' | 'admin'

function recoveryPath(surface: Surface) {
  return surface === 'admin' ? '/admin/notebook/manage#recovery' : '/planner/notebook/manage#recovery'
}

function makeGuide(kind: 'share' | 'voice', text: string) {
  const guide = document.createElement('div')
  guide.dataset.notebookClarityGuide = kind
  guide.className = 'rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-white/70'
  guide.textContent = text
  return guide
}

function setButtonText(button: HTMLButtonElement, from: string, to: string) {
  for (const node of Array.from(button.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === from) {
      node.textContent = ` ${to}`
    }
  }
}

export function NotebookOperationsClarity({
  surface,
  transcriptionConfigured,
}: {
  surface: Surface
  transcriptionConfigured: boolean
}) {
  useEffect(() => {
    const archiveApproved = new WeakSet<HTMLButtonElement>()

    const enhance = () => {
      const archive = document.querySelector<HTMLButtonElement>('button[title="Archive"], button[data-notebook-archive]')
      if (archive) {
        archive.dataset.notebookArchive = 'true'
        // Keep the long-standing title contract because release/browser clients
        // already target it. The clearer meaning is carried by aria + confirmation.
        archive.title = 'Archive'
        archive.setAttribute('aria-label', 'Archive note — recoverable')
      }

      const trash = document.querySelector<HTMLButtonElement>('button[title="Trash"], button[data-notebook-trash]')
      if (trash) {
        trash.dataset.notebookTrash = 'true'
        // Preserve title="Trash" for backwards-compatible automation and UI
        // integrations; accessible wording explains that Trash is recoverable.
        trash.title = 'Trash'
        trash.setAttribute('aria-label', 'Move note to Trash — recoverable')
      }

      // The compact phone toolbar uses an icon-only chevron to return to the note
      // list. Give it a stable accessible name so users and automation do not have
      // to infer its purpose from an SVG glyph.
      const backToList = document.querySelector<HTMLButtonElement>('main button.lg\\:hidden')
      if (backToList) {
        backToList.dataset.notebookBackToList = 'true'
        backToList.title = 'Back to note list'
        backToList.setAttribute('aria-label', 'Back to note list')
      }

      const shareInput = document.querySelector<HTMLInputElement>('input[placeholder="Existing Wewed user email"]')
      const sharePanel = shareInput?.parentElement
      if (sharePanel && !sharePanel.querySelector('[data-notebook-clarity-guide="share"]')) {
        sharePanel.insertBefore(
          makeGuide(
            'share',
            'Sharing controls secure Wewed access. Enter an existing Wewed user and choose Can view or Can edit. Wedding team visibility makes the note available to active wedding members. Wewed creates a persistent in-app notification; verified and enabled Email or WhatsApp delivery follows each recipient’s communication settings. External notifications contain a secure Wewed link, not a copy of the note.',
          ),
          shareInput,
        )
      }

      const consentText = Array.from(document.querySelectorAll('span')).find((element) =>
        element.textContent?.includes('recorded/transcribed'),
      )
      const voiceCard = consentText?.closest('div.rounded-xl')
      if (voiceCard && !voiceCard.querySelector('[data-notebook-clarity-guide="voice"]')) {
        const message = transcriptionConfigured
          ? 'Record & transcribe: after participants consent, Wewed saves the private audio first and then automatically transcribes it. When the transcript is ready you can append it to the note, review names/amounts/decisions, and then use AI.'
          : 'Recording is available, but automatic transcription is not configured on this deployment. Wewed will still preserve the private audio safely. Once transcription is configured, saved recordings can be transcribed or retried without recording the meeting again.'
        voiceCard.insertBefore(makeGuide('voice', message), voiceCard.firstChild)
      }

      for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('button'))) {
        if (button.textContent?.trim() === 'Record') {
          setButtonText(button, 'Record', transcriptionConfigured ? 'Record & transcribe' : 'Record audio')
          button.title = transcriptionConfigured
            ? 'Record the meeting and automatically transcribe after the audio is saved'
            : 'Record and preserve meeting audio; transcription is not configured yet'
        }
      }
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null
      if (!(target instanceof HTMLButtonElement) || target.dataset.notebookArchive !== 'true') return
      if (archiveApproved.has(target)) {
        archiveApproved.delete(target)
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      const confirmed = window.confirm(
        'Archive this note?\n\nArchive removes it from the active Notebook list, but does NOT delete it. You can restore it at any time from Recovery.',
      )
      if (!confirmed) return
      archiveApproved.add(target)
      target.click()
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', handleClick, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
    }
  }, [transcriptionConfigured])

  return (
    <a
      href={recoveryPath(surface)}
      data-notebook-recovery-shortcut
      className="fixed right-3 top-3 z-[55] rounded-xl border border-gold/25 bg-espresso/95 px-3 py-2 text-xs font-semibold text-gold shadow-xl backdrop-blur hover:bg-gold/10 md:right-5 md:top-5"
      title="Restore archived or trashed Notebook notes; manage files and tags"
    >
      Recovery · files · tags
    </a>
  )
}
