"use client";

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
  type WeddingProgrammeItem,
  type WeddingSong,
} from "@/lib/wedding-data";

interface WeddingContextValue {
  wedding: WeddingInfo | null;
  content: WeddingContentMap;
  contentMeta: Record<string, Record<string, string | null>>;
  ordered: Record<string, WeddingContentRow[]>;
  programmeItems: WeddingProgrammeItem[];
  songs: WeddingSong[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  slug: string;
  /** Regression marker only — never use this to select a different renderer. */
  isFlagship: boolean;
  getContent: (
    section: string,
    field: string,
    defaultValue?: string,
  ) => string;
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
    programmeItems,
    songs,
    loading,
    error,
    refetch,
  } = useWeddingData(slug);

  const value = useMemo<WeddingContextValue>(() => {
    const activeSlug = wedding?.slug ?? slug ?? FLAGSHIP_WEDDING_SLUG;
    const data: WeddingData | null = wedding
      ? { wedding, content, contentMeta, ordered, programmeItems, songs }
      : null;

    return {
      wedding,
      content,
      contentMeta,
      ordered,
      programmeItems,
      songs,
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
  }, [
    wedding,
    content,
    contentMeta,
    ordered,
    programmeItems,
    songs,
    loading,
    error,
    refetch,
    slug,
  ]);

  return (
    <WeddingContext.Provider value={value}>
      {children}
    </WeddingContext.Provider>
  );
}

export function useWeddingContext(): WeddingContextValue {
  const ctx = useContext(WeddingContext);
  if (!ctx) {
    throw new Error(
      "useWeddingContext must be used inside a <WeddingDataProvider>.",
    );
  }
  return ctx;
}

export function useWeddingContextSafe(): WeddingContextValue | null {
  return useContext(WeddingContext);
}

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
  WeddingProgrammeItem,
  WeddingSong,
};
