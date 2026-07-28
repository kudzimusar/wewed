'use client';

/**
 * inline-content.ts — a tiny localStorage-backed inline editing layer.
 *
 * The couple logs in via CoupleLogin (password: wewed-admin-2026), which flips
 * `editMode = true` in the Zustand store. When editMode is ON, every editable
 * section renders an <InlineEditButton> pencil. Clicking it opens a Dialog
 * with a textarea bound to this section+field's stored value.
 *
 * Storage layout (per section+field):
 *   key:   `wewed:content:{section}:{field}`
 *   value: arbitrary string (the couple's edited copy)
 *
 * Reads return '' when nothing is stored. Consuming components pass a
 * `defaultValue` (the original hardcoded copy) so the public site always
 * renders something meaningful even before any edit has been made.
 *
 * Cross-component sync: every write dispatches a `wewed:content-change`
 * CustomEvent on window. The `useInlineContent` hook listens for it so an
 * edit in the InlineEditButton dialog updates the display instantly without
 * a page reload.
 */

import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'wewed:content';
const EVENT_NAME = 'wewed:content-change';

/** Build the localStorage key for a (section, field) pair. */
function key(section: string, field: string): string {
  return `${PREFIX}:${section}:${field}`;
}

/** True if localStorage is available (skips on SSR / private mode). */
function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Read the stored value for a section+field. Returns '' if not found. */
export function getInlineContent(section: string, field: string): string {
  if (!hasStorage()) return '';
  try {
    return window.localStorage.getItem(key(section, field)) ?? '';
  } catch {
    return '';
  }
}

/** Write (or overwrite) the stored value and notify listeners. */
export function setInlineContent(
  section: string,
  field: string,
  value: string,
): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key(section, field), value);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { section, field, value },
      }),
    );
  } catch {
    /* swallow quota / private-mode errors */
  }
}

/** Remove the stored value, reverting the display to its default. */
export function clearInlineContent(section: string, field: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(key(section, field));
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { section, field, value: '' },
      }),
    );
  } catch {
    /* ignore */
  }
}

export interface InlineContentChangeEvent {
  section: string;
  field: string;
  value: string;
}

/**
 * React hook that returns the current display value for a section+field.
 *
 * @param section      Logical section id (e.g. "story", "theday", "hero").
 * @param field        Field id within the section (e.g. "milestone-0-title").
 * @param defaultValue The original hardcoded copy — shown until the couple
 *                     edits. The hook initialises to this on both server and
 *                     client to avoid hydration mismatches, then syncs from
 *                     localStorage after mount.
 *
 * @returns [value, setValue, reset]
 *   - value: the string to render
 *   - setValue: writes to localStorage AND updates state immediately
 *   - reset: clears localStorage and restores defaultValue
 */
export function useInlineContent(
  section: string,
  field: string,
  defaultValue: string = '',
): [string, (value: string) => void, () => void] {
  // SSR-safe initial state — defaultValue is the same on server and client.
  const [value, setValueState] = useState<string>(defaultValue);

  useEffect(() => {
    // After mount, sync from localStorage (may differ from defaultValue if
    // the couple has previously edited this field).
    const stored = getInlineContent(section, field);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValueState(stored || defaultValue);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<InlineContentChangeEvent>).detail;
      if (!detail) return;
      if (detail.section === section && detail.field === field) {
        setValueState(detail.value || defaultValue);
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [section, field, defaultValue]);

  const setValue = useCallback(
    (next: string) => {
      setValueState(next); // immediate UI feedback
      setInlineContent(section, field, next);
    },
    [section, field],
  );

  const reset = useCallback(() => {
    setValueState(defaultValue);
    clearInlineContent(section, field);
  }, [section, field, defaultValue]);

  return [value, setValue, reset];
}
