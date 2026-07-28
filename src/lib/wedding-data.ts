"use client";

/**
 * wedding-data.ts
 * ------------------------------------------------------------
 * Client-side types + hook + helpers for the multi-couple
 * data-driven content layer.
 *
 * Single source of truth for:
 *   • TypeScript types matching the /api/wedding-content response
 *   • useWeddingData(slug?) — React hook that fetches + caches
 *     wedding content in component state
 *   • getContent(content, section, field, defaultValue) — safe
 *     single-field accessor
 *   • getOrderedContent(content, section, prefix) — returns
 *     ordered items (milestones, programme, features, faq, cards)
 *     sorted by `order`, with metadata parsed back to objects
 *
 * The hook is SSR-safe: it only fetches after mount and returns
 * `loading: true` for the first render so server-rendered markup
 * matches the very first client render (avoids hydration warnings).
 */

import { useCallback, useEffect, useState } from "react";

// ─── types ────────────────────────────────────────────────────

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
  date: string; // ISO string from Prisma DateTime
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

/** A single WeddingContent row's client-side representation. */
export interface WeddingContent {
  field: string;
  value: string;
  order: number;
  metadata: string | null;
}

/** The nested content map: { [section]: { [field]: value } }. */
export type WeddingContentMap = Record<string, Record<string, string>>;

/** The full API response from GET /api/wedding-content. */
export interface WeddingData {
  wedding: WeddingInfo;
  content: WeddingContentMap;
  /** Metadata map mirroring `content` shape — JSON strings or null. */
  contentMeta: Record<string, Record<string, string | null>>;
  /** Ordered items grouped by section, pre-sorted by `order`. */
  ordered: Record<string, WeddingContent[]>;
}

// ─── helpers ──────────────────────────────────────────────────

/**
 * Safely read a single content field. Returns `defaultValue`
 * when the section, field, or wedding data is missing.
 *
 * @example
 *   const bride = getContent(content, "hero", "brideName", "Charity")
 */
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

/**
 * Parse a metadata JSON string into an object. Returns `{}`
 * if the string is null, empty, or fails to parse.
 */
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

/**
 * Fetch all ordered items for a section + prefix, sorted by `order`.
 *
 * The flagship seed stores ordered items as `<prefix>-<index>`
 * (e.g. `milestone-0`, `programme-3`, `feature-5`, `item-7`,
 * `card-1`, `moment-2`). This helper returns them as a clean
 * array of `{ index, value, order, metadata }` objects.
 *
 * Accepts either the full `WeddingData` (uses the precomputed
 * `ordered` index) or just the content map (falls back to a
 * client-side scan + sort).
 *
 * @example
 *   const milestones = getOrderedContent(data, "story", "milestone")
 *   // → [{ index: 0, value: "When Two Worlds Met", order: 0, metadata: { icon: "✦", body: "..." } }, ...]
 */
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

  // Fast path: the server pre-computed an ordered index for us.
  // But it indexes by section only, so we still need to filter
  // by prefix client-side. (The server can't know which prefix
  // the caller wants.)
  const source: Array<{
    field: string;
    value: string;
    order: number;
    metadata: string | null;
  }> = data.ordered?.[section] ?? [];

  // If the server index missed this section (e.g. content was
  // added after the GET), fall back to scanning the flat map.
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

// ─── slug resolution ──────────────────────────────────────────

export const FLAGSHIP_WEDDING_SLUG = "charity-and-kudzie";

/**
 * Read the `?wedding=` param from the current URL.
 * Returns "charity-and-kudzie" when not present (flagship default).
 * Safe on the server (returns the default) — call inside useEffect
 * for accurate client-side reads.
 */
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

// ─── hook ─────────────────────────────────────────────────────

interface UseWeddingDataResult {
  wedding: WeddingInfo | null;
  content: WeddingContentMap;
  contentMeta: Record<string, Record<string, string | null>>;
  ordered: Record<string, WeddingContent[]>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch + cache wedding content for a slug.
 *
 * @param slug  The wedding slug. If omitted, reads `?wedding=`
 *              from the URL on mount (defaults to "charity-and-kudzie").
 *
 * @returns { wedding, content, contentMeta, ordered, loading, error, refetch }
 *
 * The hook stores the result in component state — no global store
 * (Zustand/React Query) for the MVP. A `refetch()` is exposed for
 * manual refreshes after a content edit.
 */
export function useWeddingData(slug?: string): UseWeddingDataResult {
  const [data, setData] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchSignal, setRefetchSignal] = useState<number>(0);

  // Resolve the slug once on mount (or when the prop changes).
  // On the server, slug ?? FLAGSHIP_WEDDING_SLUG keeps the first
  // render stable.
  const [resolvedSlug, setResolvedSlug] = useState<string>(
    slug ?? FLAGSHIP_WEDDING_SLUG,
  );

  useEffect(() => {
    if (slug) {
      setResolvedSlug(slug);
      return;
    }
    // No slug prop — read from URL on the client.
    const fromUrl = readWeddingSlugFromUrl();
    setResolvedSlug(fromUrl);
  }, [slug]);

  // Listen for URL changes (e.g. user clicks a link to a different
  // couple's wedding). Updates the resolved slug in-place.
  useEffect(() => {
    if (slug) return; // explicit slug prop wins
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
        if (!cancelled) {
          setData(json.data);
        }
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
    loading,
    error,
    refetch,
  };
}
