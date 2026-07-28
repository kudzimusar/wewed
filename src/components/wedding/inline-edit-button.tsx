'use client';

/**
 * InlineEditButton — the pencil that appears on editable text when the
 * couple has logged in and turned edit mode ON.
 *
 * Behaviour:
 * - Reads `editMode` from the Zustand store. When OFF, renders nothing.
 * - When ON, renders a subtle pencil button next to the editable text.
 * - Clicking opens a Dialog with a Textarea bound to the (section, field)
 *   stored value, pre-filled with the current edited value or the
 *   `defaultValue` if no edit has been made yet.
 * - Save writes to localStorage via setInlineContent; the display updates
 *   instantly thanks to the `wewed:content-change` event the hook listens to.
 * - Reset clears the stored value, reverting to the original copy.
 *
 * Usage:
 *   <InlineEditButton section="story" field="m0-title" label="Milestone title"
 *                     defaultValue={milestone.title} />
 */

import { useEffect, useState } from 'react';
import { Pencil, Save, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useWewedStore } from '@/lib/store';
import {
  getInlineContent,
  setInlineContent,
  clearInlineContent,
} from '@/lib/inline-content';
import { toast } from 'sonner';

export interface InlineEditButtonProps {
  /** Logical section id (e.g. "story", "theday", "hero"). */
  section: string;
  /** Field id within the section (e.g. "milestone-0-title"). */
  field: string;
  /** Human-friendly label shown in the dialog header. */
  label: string;
  /** Original hardcoded copy — used to pre-fill the textarea when no
   *  edit has been made yet. Optional but recommended. */
  defaultValue?: string;
  /** Optional size variant — "sm" for tight inline spots, "md" for headers. */
  size?: 'sm' | 'md';
  /** Optional className passthrough for positioning tweaks. */
  className?: string;
}

export function InlineEditButton({
  section,
  field,
  label,
  defaultValue = '',
  size = 'sm',
  className,
}: InlineEditButtonProps) {
  const editMode = useWewedStore((s) => s.editMode);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>('');

  // When the dialog opens, hydrate the textarea from localStorage (or default).
  useEffect(() => {
    if (!open) return;
    const stored = getInlineContent(section, field);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(stored || defaultValue);
  }, [open, section, field, defaultValue]);

  // Hidden whenever editMode is OFF — keeps the public site clean.
  if (!editMode) return null;

  const handleSave = () => {
    const trimmed = draft;
    // If the draft matches the default, clear the stored value so the
    // display naturally falls back. Otherwise persist the new copy.
    if (trimmed === defaultValue || trimmed.trim() === '') {
      clearInlineContent(section, field);
      toast.success(`Reverted "${label}" to original`);
    } else {
      setInlineContent(section, field, trimmed);
      toast.success(`Saved "${label}"`);
    }
    setOpen(false);
  };

  const handleReset = () => {
    setDraft(defaultValue);
    clearInlineContent(section, field);
    toast.info(`Reset "${label}" to original`);
  };

  const sizeClasses =
    size === 'sm'
      ? 'h-7 w-7 rounded-full'
      : 'h-9 w-9 rounded-full';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${label}`}
        title={`Click to edit: ${label}`}
        className={`inline-flex items-center justify-center border-2 border-gold bg-gold/20 text-gold shadow-md transition-all hover:bg-gold hover:text-espresso focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1 animate-pulse ${sizeClasses} ${className ?? ''}`}
      >
        <Pencil className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.5} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-gold/30 bg-champagne">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-xl font-light text-espresso">
              <Pencil className="h-4 w-4 text-gold" />
              Edit {label}
            </DialogTitle>
            <DialogDescription className="text-espresso/60">
              Changes are saved to this browser and appear instantly on the
              site. They persist across refreshes for you and anyone using
              this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Enter the new text for "${label}"…`}
              className="min-h-[120px] resize-y border-gold/30 bg-white/70 font-sans text-sm text-espresso placeholder:text-espresso/40 focus:border-gold focus:ring-gold/20"
              autoFocus
            />
            {defaultValue && (
              <p className="font-sans text-[11px] leading-relaxed text-espresso/45">
                <span className="font-semibold uppercase tracking-[0.15em] text-espresso/55">
                  Original:
                </span>{' '}
                {defaultValue.length > 140
                  ? `${defaultValue.slice(0, 140)}…`
                  : defaultValue}
              </p>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-espresso/60 hover:bg-clay/10 hover:text-clay"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset to original
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="border-espresso/20 bg-transparent text-espresso/70 hover:bg-espresso/5 hover:text-espresso"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                className="bg-gold text-espresso hover:bg-gold/90"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InlineEditButton;
