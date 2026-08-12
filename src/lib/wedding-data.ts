"use client";

import { useCallback, useEffect, useState } from "react";

export interface WeddingCouple {
  id: string;
  slug: string;
  partner1: string;
  partner2: string;
  surname: string | null;
  photo: string | null;
  subscriptionStatus: string;
}

export interface WeddingTheme {
  primaryColor: string;
  accentColor: string;
  memoryColor: string;
  backgroundColor: string;
}

export interface WeddingInfo {
  id: string;
  slug: string;
  title: string;
  monogram: string | null;
  tagline: string | null;
  date: string;
  venue: string;
  venueCity: string;
  venueCountry: string;
  venueMapUrl: string | null;
  lifecycle: "before" | "after" | string;
  privacy: string;
  canonSealed: boolean;
  subscriptionTier: string;
  theme: WeddingTheme;
  couple: WeddingCouple;
}

export interface WeddingProgrammeItem {
  id: string;
  time: string;
  title: string;
  description: string | null;
  icon: string | null;
  duration: string | null;
  location: string | null;
  displayIcon: string | null;
  order: number;
}

export interface WeddingSong {
  id: string;
  title: string;
  artist: string;
  phase: string;
  moment: string | null;
  order: number;
  votes: number;
  spotifyUrl: string | null;
  appleUrl: string | null;
  playedAt: string | null;
  notes: string | null;
}

export interface WeddingContent {
  field: string;
  value: string;
  order: number;
  metadata: string | null;
}

export type WeddingContentMap = Record<string, Record<string, string>>;

export interface WeddingData {
  wedding: WeddingInfo;
  content: WeddingContentMap;
  contentMeta: Record<string, Record<string, string | null>>;
  ordered: Record<string, WeddingContent[]>;
  programmeItems: WeddingProgrammeItem[];
  songs: WeddingSong[];
}

export function getContent(
  content: WeddingContentMap | null | undefined,
  section: string,
  field: string,
  defaultValue: string = "",
): string {
  if (!content || !content[section]) return defaultValue;
  const v = content[section][field];
  return v == null || v === "" ? defaultValue : v;
}

export function parseMetadata(
  meta: string | null | undefined,
): Record<string, unknown> {
  if (!meta) return {};
  try {
    const parsed = JSON.parse(meta);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getOrderedContent(
  data: WeddingData | null | undefined,
  section: string,
  prefix: string,
): Array<{
  index: number;
  field: string;
  value: string;
  order: number;
  metadata: Record<string, unknown>;
}> {
  if (!data) return [];

  const source: Array<{
    field: string;
    value: string;
    order: number;
    metadata: string | null;
  }> = data.ordered?.[section] ?? [];

  const rows =
    source.length > 0
      ? source
      : Object.entries(data.content?.[section] ?? {}).map(([field, value]) => ({
          field,
          value,
          order: 0,
          metadata: data.contentMeta?.[section]?.[field] ?? null,
        }));

  const prefixWithDash = prefix.endsWith("-") ? prefix : `${prefix}-`;
  const out: Array<{
    index: number;
    field: string;
    value: string;
    order: number;
    metadata: Record<string, unknown>;
  }> = [];

  for (const row of rows) {
    if (!row.field.startsWith(prefixWithDash)) continue;
    const idxStr = row.field.slice(prefixWithDash.length);
    if (!/^\d+$/.test(idxStr)) continue;
    const idx = Number.parseInt(idxStr, 10);
    if (!Number.isFinite(idx)) continue;
    out.push({
      index: idx,
      field: row.field,
      value: row.value,
      order: row.order,
      metadata: parseMetadata(row.metadata),
    });
  }

  out.sort((a, b) =>
    a.order === b.order
      ? a.index - b.index
      : a.order - b.order,
  );

  return out;
}

export const FLAGSHIP_WEDDING_SLUG = "charity-and-kudzie";

export function readWeddingSlugFromUrl(): string {
  if (typeof window === "undefined") return FLAGSHIP_WEDDING_SLUG;
  try {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("wedding")?.trim();
    return slug || FLAGSHIP_WEDDING_SLUG;
  } catch {
    return FLAGSHIP_WEDDING_SLUG;
  }
}

interface UseWeddingDataResult {
  wedding: WeddingInfo | null;
  content: WeddingContentMap;
  contentMeta: Record<string, Record<string, string | null>>;
  ordered: Record<string, WeddingContent[]>;
  programmeItems: WeddingProgrammeItem[];
  songs: WeddingSong[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWeddingData(slug?: string): UseWeddingDataResult {
  const [data, setData] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchSignal, setRefetchSignal] = useState<number>(0);
  const [resolvedSlug, setResolvedSlug] = useState<string>(
    slug ?? FLAGSHIP_WEDDING_SLUG,
  );

  useEffect(() => {
    if (slug) {
      setResolvedSlug(slug);
      return;
    }
    setResolvedSlug(readWeddingSlugFromUrl());
  }, [slug]);

  useEffect(() => {
    if (slug) return;
    const handler = () => {
      setResolvedSlug(readWeddingSlugFromUrl());
    };
    window.addEventListener("popstate", handler);
    window.addEventListener("wewed:slug-change", handler as EventListener);
    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("wewed:slug-change", handler as EventListener);
    };
  }, [slug]);

  const refetch = useCallback(() => {
    setRefetchSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!resolvedSlug) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/wedding-content?slug=${encodeURIComponent(resolvedSlug)}`,
          {
            signal: controller.signal,
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error || `Failed to load wedding (${res.status})`,
          );
        }
        const json = (await res.json()) as {
          success?: boolean;
          data?: WeddingData;
          error?: string;
        };
        if (!json.success || !json.data) {
          throw new Error(json.error || "Malformed response from server.");
        }
        if (!cancelled) setData(json.data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resolvedSlug, refetchSignal]);

  return {
    wedding: data?.wedding ?? null,
    content: data?.content ?? {},
    contentMeta: data?.contentMeta ?? {},
    ordered: data?.ordered ?? {},
    programmeItems: data?.programmeItems ?? [],
    songs: data?.songs ?? [],
    loading,
    error,
    refetch,
  };
}
