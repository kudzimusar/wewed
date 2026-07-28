"use client";

/**
 * wedding-data-provider.tsx
 * ------------------------------------------------------------
 * React Context that holds the active wedding's data-driven
 * content. Reads the slug from the `?wedding=` URL param
 * (defaulting to "charity-and-kudzie"), fetches once on mount,
 * and exposes `{ wedding, content, contentMeta, ordered,
 * loading, error, refetch }` to all descendants via the
 * `useWeddingContext()` hook.
 *
 * Wrap the entire app (in page.tsx or layout.tsx) so every
 * wedding section component can read content without each one
 * having to call the API independently.
 *
 * Usage:
 *   <WeddingDataProvider>
 *     <HeroSection />
 *     <OurStory />
 *     ...
 *   </WeddingDataProvider>
 *
 *   // inside any child:
 *   const { content, getContent } = useWeddingContext();
 *   const bride = getContent("hero", "brideName", "Charity");
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  useWeddingData,
  getContent as getContentBase,
  getOrderedContent as getOrderedContentBase,
  parseMetadata,
  FLAGSHIP_WEDDING_SLUG,
  type WeddingData,
  type WeddingInfo,
  type WeddingContentMap,
  type WeddingContent as WeddingContentRow,
} from "@/lib/wedding-data";

interface WeddingContextValue {
  wedding: WeddingInfo | null;
  content: WeddingContentMap;
  contentMeta: Record<string, Record<string, string | null>>;
  ordered: Record<string, WeddingContentRow[]>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  slug: string;
  /** True when this is the flagship Charity & Kudzie wedding. */
  isFlagship: boolean;
  /** Convenience accessor — see getContent() in /lib/wedding-data. */
  getContent: (
    section: string,
    field: string,
    defaultValue?: string,
  ) => string;
  /** Convenience accessor — see getOrderedContent() in /lib/wedding-data. */
  getOrdered: (
    section: string,
    prefix: string,
  ) => Array<{
    index: number;
    field: string;
    value: string;
    order: number;
    metadata: Record<string, unknown>;
  }>;
}

const WeddingContext = createContext<WeddingContextValue | null>(null);

interface WeddingDataProviderProps {
  children: ReactNode;
  /** Optional explicit slug — overrides ?wedding= URL param. */
  slug?: string;
}

export function WeddingDataProvider({
  children,
  slug,
}: WeddingDataProviderProps) {
  const {
    wedding,
    content,
    contentMeta,
    ordered,
    loading,
    error,
    refetch,
  } = useWeddingData(slug);

  const value = useMemo<WeddingContextValue>(() => {
    const activeSlug = wedding?.slug ?? slug ?? FLAGSHIP_WEDDING_SLUG;
    const data: WeddingData | null = wedding
      ? { wedding, content, contentMeta, ordered }
      : null;

    return {
      wedding,
      content,
      contentMeta,
      ordered,
      loading,
      error,
      refetch,
      slug: activeSlug,
      isFlagship: activeSlug === FLAGSHIP_WEDDING_SLUG,
      getContent: (section, field, defaultValue = "") =>
        getContentBase(content, section, field, defaultValue),
      getOrdered: (section, prefix) =>
        getOrderedContentBase(data, section, prefix),
    };
  }, [wedding, content, contentMeta, ordered, loading, error, refetch, slug]);

  return (
    <WeddingContext.Provider value={value}>
      {children}
    </WeddingContext.Provider>
  );
}

/**
 * Access the active wedding's data from any descendant of
 * <WeddingDataProvider>. Throws if used outside the provider
 * (developer error — surfaces a clear message instead of a
 * cryptic null deref).
 */
export function useWeddingContext(): WeddingContextValue {
  const ctx = useContext(WeddingContext);
  if (!ctx) {
    throw new Error(
      "useWeddingContext must be used inside a <WeddingDataProvider>.",
    );
  }
  return ctx;
}

/**
 * Safe version — returns null instead of throwing when used outside
 * a <WeddingDataProvider>. Use this in components that should work
 * both with and without the provider (e.g. legacy components).
 */
export function useWeddingContextSafe(): WeddingContextValue | null {
  return useContext(WeddingContext);
}

// Re-export the helpers + types so consumers can import everything
// from one place if they prefer.
export {
  getContentBase as getContent,
  getOrderedContentBase as getOrderedContent,
  parseMetadata,
  FLAGSHIP_WEDDING_SLUG,
};
export type {
  WeddingData,
  WeddingInfo,
  WeddingContentMap,
  WeddingContentRow,
};
