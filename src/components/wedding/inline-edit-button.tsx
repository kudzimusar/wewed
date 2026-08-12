'use client';

import { useEffect, useState } from 'react';
import { Pencil, Save, X, RotateCcw, Loader2 } from 'lucide-react';
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
} from '@/lib/inline-content';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';
import { toast } from 'sonner';

export interface InlineEditButtonProps {
  section: string;
  field: string;
  label: string;
  defaultValue?: string;
  size?: 'sm' | 'md';
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
  const ctx = useWeddingContextSafe();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const stored = getInlineContent(section, field);
    setDraft(stored || defaultValue);
  }, [open, section, field, defaultValue]);

  if (!editMode) return null;

  async function persist(value: string): Promise<boolean> {
    if (!ctx?.slug) return false;
    setSaving(true);
    try {
      const response = await fetch('/api/wedding-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: ctx.slug,
          section,
          field,
          value,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Unable to save this wedding content.');
      }

      // Keep instant same-browser feedback while the server-backed wedding
      // content is refetched. The database is now the shared source of truth.
      setInlineContent(section, field, value);
      ctx.refetch();
      return true;
    } catch (error) {
      toast.error(`Could not save "${label}"`, {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const handleSave = async () => {
    const value = draft.trim() === '' ? defaultValue : draft;
    if (await persist(value)) {
      toast.success(`Saved "${label}" for this wedding`);
      setOpen(false);
    }
  };

  const handleReset = async () => {
    setDraft(defaultValue);
    if (await persist(defaultValue)) {
      toast.info(`Reset "${label}" to its current template value`);
      setOpen(false);
    }
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
              Changes are saved to this wedding and are shared across the couple, authorised planner and guest-facing site according to permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Enter the new text for "${label}"…`}
              className="min-h-[120px] resize-y border-gold/30 bg-white/70 font-sans text-sm text-espresso placeholder:text-espresso/40 focus:border-gold focus:ring-gold/20"
              autoFocus
              disabled={saving}
            />
            {defaultValue && (
              <p className="font-sans text-[11px] leading-relaxed text-espresso/45">
                <span className="font-semibold uppercase tracking-[0.15em] text-espresso/55">
                  Current template value:
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
              onClick={() => void handleReset()}
              disabled={saving}
              className="text-espresso/60 hover:bg-clay/10 hover:text-clay"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="border-espresso/20 bg-transparent text-espresso/70 hover:bg-espresso/5 hover:text-espresso"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving}
                className="bg-gold text-espresso hover:bg-gold/90"
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
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
