/**
 * wewed — Collaborative Guest Contributions
 * ============================================================================
 * Shared utilities, validation, and anti-abuse helpers for the guest
 * contribution feature (Task CONTRIB-1).
 *
 * Used by:
 *   - /api/contribute          (guest editor — token-gated)
 *   - /api/contributions       (admin moderation list + token generation)
 *   - /api/contributions/[id]  (admin PATCH status)
 *   - /api/contributions/public (public approved feed)
 *
 * Design principles:
 *   - All guest-supplied text is untrusted. Always validate + sanitize.
 *   - Anti-abuse rules: word/char caps, no HTML, no URLs, no phone numbers,
 *     no emails, no profanity.
 *   - Rate limit: editCount <= MAX_EDITS before submission is blocked.
 *   - Tokens are 32-char hex (crypto.randomBytes(16)) and unique per guest.
 * ============================================================================
 */

import { randomBytes } from "crypto";

// ─── Limits ────────────────────────────────────────────────────────────────

export const MAX_WORDS = 500;
export const MAX_CHARS = 2500;
export const MAX_EDITS = 10;
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── Types ─────────────────────────────────────────────────────────────────

export const CONTRIBUTION_TYPES = [
  "memory",
  "advice",
  "blessing",
  "funny_story",
  "wish",
] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  memory: "A Memory",
  advice: "Advice",
  blessing: "A Blessing",
  funny_story: "A Funny Story",
  wish: "A Wish",
};

export const PRIVACY_OPTIONS = ["public", "couple_only", "anonymous"] as const;
export type PrivacyOption = (typeof PRIVACY_OPTIONS)[number];

export const PRIVACY_LABELS: Record<PrivacyOption, string> = {
  public: "Public — show on the guest wall",
  couple_only: "Couple only — only Charity & Kudzie will see this",
  anonymous: "Anonymous — show without my name",
};

/** All statuses a contribution can be in (matches Prisma `status` field). */
export const ALL_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "featured",
  "hidden",
] as const;
export type ContributionStatus = (typeof ALL_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  none: "Not started",
  draft: "Draft",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  featured: "Featured",
  hidden: "Hidden",
};

/** Statuses that should be returned by the public endpoint. */
export const PUBLIC_STATUSES: ContributionStatus[] = ["approved", "featured"];

// ─── Token ─────────────────────────────────────────────────────────────────

/**
 * Generate a 32-char hex token (crypto.randomBytes(16)).
 * Used as the per-guest contribution editor URL token.
 */
export function generateToken(): string {
  return randomBytes(16).toString("hex");
}

// ─── Word / Char counting ──────────────────────────────────────────────────

/** Count words in a string. Whitespace runs separate words. Empty => 0. */
export function countWords(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/** Count characters in a string. Empty => 0. */
export function countChars(text: string): number {
  if (!text) return 0;
  return text.length;
}

// ─── Anti-abuse: profanity list ────────────────────────────────────────────

/**
 * A small built-in list of ~30 common English profanity words.
 * Intentionally NOT an external library — keeps the dependency footprint
 * minimal and avoids false positives from overzealous filters.
 *
 * Matched case-insensitively as whole words (word-boundary regex).
 * Replace with a more comprehensive list if needed in the future.
 */
const PROFANITY_WORDS: readonly string[] = [
  "arse",
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "damn",
  "dick",
  "dickhead",
  "douche",
  "dumbass",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "goddamn",
  "hell",
  "jackass",
  "motherfucker",
  "nigga",
  "nigger",
  "piss",
  "prick",
  "pussy",
  "shit",
  "shitty",
  "slut",
  "twat",
  "wank",
  "wanker",
  "whore",
];

// Pre-compile one regex that matches any profanity word as a whole word.
const PROFANITY_REGEX = new RegExp(
  `\\b(${PROFANITY_WORDS.map((w) => escapeRegex(w)).join("|")})\\b`,
  "i"
);

// ─── Anti-abuse: HTML / URL / phone / email patterns ───────────────────────

/**
 * HTML detection: reject if `<` or `>` is immediately followed by a letter.
 * This catches `<script>`, `<b>`, `</div>` etc. without false-flagging on
 * legitimate math like `a < b` or `2 > 1`.
 */
const HTML_TAG_REGEX = /<[a-zA-Z\/]/;

/** URL detection: http://, https://, ftp://, www. (case-insensitive). */
const URL_REGEX = /(https?:\/\/|ftp:\/\/|www\.)/i;

/**
 * Phone-number detection.
 *  - Country codes starting with + (e.g. +263 for Zimbabwe)
 *  - 10 or more consecutive digits (after stripping non-digit separators)
 */
const PHONE_COUNTRY_REGEX = /\+\d{1,4}[\s-]?\d/;
const PHONE_LONG_DIGITS_REGEX = /\d[\s-]?(\d[\s-]?){9,}/;

/** Email detection: name@domain.tld */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// ─── Validation ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a guest contribution message.
 *
 * Checks (in order):
 *   1. Word count <= MAX_WORDS
 *   2. Char count <= MAX_CHARS
 *   3. No HTML tags
 *   4. No URLs (http://, https://, www.)
 *   5. No phone numbers (+country-code, 10+ consecutive digits)
 *   6. No email addresses
 *   7. No profanity (built-in word list)
 *
 * Returns `{ valid, errors }`. Empty/whitespace messages pass validation
 * (the caller decides whether empty is acceptable — drafts allow it,
 * submissions don't).
 */
export function validateMessage(text: string): ValidationResult {
  const errors: string[] = [];

  if (!text || typeof text !== "string") {
    return { valid: true, errors: [] }; // caller decides if empty is allowed
  }

  const words = countWords(text);
  const chars = countChars(text);

  if (words > MAX_WORDS) {
    errors.push(`Message is too long: ${words} words (max ${MAX_WORDS}).`);
  }

  if (chars > MAX_CHARS) {
    errors.push(
      `Message is too long: ${chars} characters (max ${MAX_CHARS}).`
    );
  }

  if (HTML_TAG_REGEX.test(text)) {
    errors.push("Message cannot contain HTML tags.");
  }

  if (URL_REGEX.test(text)) {
    errors.push("Message cannot contain URLs or web links.");
  }

  if (PHONE_COUNTRY_REGEX.test(text) || PHONE_LONG_DIGITS_REGEX.test(text)) {
    errors.push("Message cannot contain phone numbers.");
  }

  if (EMAIL_REGEX.test(text)) {
    errors.push("Message cannot contain email addresses.");
  }

  if (PROFANITY_REGEX.test(text)) {
    errors.push("Message contains inappropriate language.");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Sanitization ──────────────────────────────────────────────────────────

/**
 * Sanitize a guest-supplied message for safe storage + display.
 *
 * Steps:
 *   1. Trim leading/trailing whitespace.
 *   2. Normalize newlines to `\n`.
 *   3. Collapse runs of spaces/tabs into a single space (per line).
 *   4. Collapse 3+ consecutive newlines down to 2 (single blank line).
 *   5. Escape HTML entities (&, <, >, ", ') to prevent XSS on render.
 *
 * Returns the sanitized string. Empty input returns "".
 */
export function sanitizeMessage(text: string): string {
  if (!text || typeof text !== "string") return "";

  let out = text
    .replace(/\r\n?/g, "\n") // normalize newlines
    .replace(/[^\S\n]+/g, " ") // collapse spaces/tabs (keep newlines)
    .replace(/\n{3,}/g, "\n\n") // max one blank line between paragraphs
    .trim();

  // Escape HTML entities — defence in depth even though React escapes
  // text by default. This guarantees safety if the message is ever
  // rendered with dangerouslySetInnerHTML or echoed into an attribute.
  out = out
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return out;
}

/**
 * Sanitize a single-line text field (display name, relationship, song).
 * Same as sanitizeMessage but also strips newlines entirely.
 */
export function sanitizeSingleLine(text: string): string {
  if (!text || typeof text !== "string") return "";
  return sanitizeMessage(text.replace(/[\r\n]+/g, " "));
}

// ─── Type guards ───────────────────────────────────────────────────────────

export function isContributionType(value: unknown): value is ContributionType {
  return (
    typeof value === "string" &&
    (CONTRIBUTION_TYPES as readonly string[]).includes(value)
  );
}

export function isPrivacyOption(value: unknown): value is PrivacyOption {
  return (
    typeof value === "string" &&
    (PRIVACY_OPTIONS as readonly string[]).includes(value)
  );
}

export function isContributionStatus(
  value: unknown
): value is ContributionStatus {
  return (
    typeof value === "string" &&
    (ALL_STATUSES as readonly string[]).includes(value)
  );
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/** Escape a string for safe interpolation into a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Revision history ──────────────────────────────────────────────────────

/**
 * Append the previous version of a contribution to its revision history JSON.
 *
 * The revision history is stored as a JSON string in the
 * `GuestContribution.revisionHistory` column (SQLite has no native array
 * type). Each entry is `{ message, displayName, type, savedAt }`.
 *
 * Returns the new JSON string. Caps the history at 50 entries to avoid
 * unbounded growth.
 */
export interface RevisionEntry {
  message: string;
  displayName: string;
  type: string;
  savedAt: string; // ISO timestamp
}

export function appendRevision(
  existingJson: string | null,
  entry: RevisionEntry
): string {
  let history: RevisionEntry[] = [];
  if (existingJson) {
    try {
      const parsed = JSON.parse(existingJson);
      if (Array.isArray(parsed)) {
        history = parsed.filter(
          (e) => e && typeof e === "object" && typeof e.message === "string"
        );
      }
    } catch {
      // corrupt JSON — start fresh
      history = [];
    }
  }
  history.push(entry);
  // Cap at 50 entries (drop oldest)
  if (history.length > 50) {
    history = history.slice(history.length - 50);
  }
  return JSON.stringify(history);
}
