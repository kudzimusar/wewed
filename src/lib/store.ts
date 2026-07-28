import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n";

export type LifecycleMode = "before" | "after";

// `Locale` is re-exported from /lib/i18n so there is a single source of truth
// for the language code. It is re-exported here for backwards-compatibility
// with any consumer that imports it from the store.
export type { Locale };

interface WewedState {
  lifecycle: LifecycleMode;
  setLifecycle: (mode: LifecycleMode) => void;
  toggleLifecycle: () => void;
  rsvpSubmitted: boolean;
  setRsvpSubmitted: (val: boolean) => void;
  musicVotes: Record<string, number>;
  toggleVote: (songId: string) => void;
  /** Active UI language. */
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  /** Whether the PWA install banner has been dismissed. */
  installPromptDismissed: boolean;
  dismissInstallPrompt: () => void;
  resetInstallPrompt: () => void;
  /**
   * Edit mode — when true and an admin is logged in, every editable
   * section of the public site shows a subtle pencil button that opens
   * the ContentEditor dialog. Persists across refreshes so the couple
   * can edit multiple sections without re-toggling.
   */
  editMode: boolean;
  setEditMode: (val: boolean) => void;
  toggleEditMode: () => void;
  /**
   * Planner open — transient UI flag that is true while the full-screen
   * WeddingPlanner Dialog is mounted. Used by AiTrigger (and any other
   * global floating widget) to hide itself so it does not stack on top
   * of the planner or steal focus/scroll from it. NOT persisted —
   * always starts false on reload.
   */
  plannerOpen: boolean;
  setPlannerOpen: (val: boolean) => void;
}

export const useWewedStore = create<WewedState>()(
  persist(
    (set, get) => ({
      lifecycle: "before",
      setLifecycle: (mode) => set({ lifecycle: mode }),
      toggleLifecycle: () =>
        set((s) => ({ lifecycle: s.lifecycle === "before" ? "after" : "before" })),
      rsvpSubmitted: false,
      setRsvpSubmitted: (val) => set({ rsvpSubmitted: val }),
      musicVotes: {},
      toggleVote: (songId) =>
        set((s) => {
          const current = s.musicVotes[songId] || 0;
          return {
            musicVotes: {
              ...s.musicVotes,
              [songId]: current > 0 ? 0 : 1,
            },
          };
        }),

      // ── Locale (English / Shona) ──────────────────────────────
      locale: "en",
      setLocale: (locale) => set({ locale }),
      toggleLocale: () =>
        set((s) => ({ locale: s.locale === "en" ? "sn" : "en" })),

      // ── PWA install prompt dismissal ──────────────────────────
      installPromptDismissed: false,
      dismissInstallPrompt: () => set({ installPromptDismissed: true }),
      resetInstallPrompt: () => set({ installPromptDismissed: false }),

      // ── Edit mode (content editing) ───────────────────────────
      editMode: false,
      setEditMode: (val) => set({ editMode: val }),
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

      // ── Planner open flag (transient, not persisted) ──────────
      plannerOpen: false,
      setPlannerOpen: (val) => set({ plannerOpen: val }),
    }),
    {
      name: "wewed-store",
      skipHydration: true,
      partialize: (state) => ({
        lifecycle: state.lifecycle,
        rsvpSubmitted: state.rsvpSubmitted,
        musicVotes: state.musicVotes,
        locale: state.locale,
        installPromptDismissed: state.installPromptDismissed,
        editMode: state.editMode,
      }),
    }
  )
);
