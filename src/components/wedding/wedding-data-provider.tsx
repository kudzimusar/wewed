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
  type WeddingData,
  type WeddingInfo,
  type WeddingContentMap,
  type WeddingContent as WeddingContentRow,
  type WeddingProgrammeItem,
  type WeddingSong,
} from "@/lib/wedding-data";
import type {
  PublicAnnouncement,
  PublicSiteItem,
  PublicSiteSection,
  PublicSiteStructure,
  SiteSectionKey,
} from "@/lib/wedding-site/model";

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
  site: PublicSiteStructure;
  announcements: PublicAnnouncement[];
  /**
   * QRO07: true only when the SERVER resolved this viewer as a member with content.edit for this
   * wedding. Owner setup prompts and edit affordances render only when this is true — never from a
   * browser flag.
   */
  canEditSite: boolean;
  /** Enabled items for a section, in order. */
  siteItems: (section: SiteSectionKey) => PublicSiteItem[];
  /** The resolved section row (enabled/order) for a key. */
  siteSection: (section: SiteSectionKey) => PublicSiteSection | undefined;
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
  initialData?: WeddingData | null;
  canEditSite?: boolean;
}

export function WeddingDataProvider({
  children,
  slug,
  initialData = null,
  canEditSite = false,
}: WeddingDataProviderProps) {
  const {
    wedding,
    content,
    contentMeta,
    ordered,
    programmeItems,
    songs,
    site,
    announcements,
    loading,
    error,
    refetch,
  } = useWeddingData(slug, initialData);

  const value = useMemo<WeddingContextValue>(() => {
    const activeSlug = wedding?.slug ?? slug ?? initialData?.wedding.slug ?? "";
    const data: WeddingData | null = wedding
      ? { wedding, content, contentMeta, ordered, programmeItems, songs, site, announcements }
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
      site,
      announcements,
      canEditSite,
      siteItems: (section) => site.items[section] ?? [],
      siteSection: (section) => site.sections.find((row) => row.key === section),
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
    site,
    announcements,
    canEditSite,
    loading,
    error,
    refetch,
    slug,
    initialData,
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
};
export type {
  WeddingData,
  WeddingInfo,
  WeddingContentMap,
  WeddingContentRow,
  WeddingProgrammeItem,
  WeddingSong,
};
