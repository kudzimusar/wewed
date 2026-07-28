'use client'

import { motion } from 'framer-motion'
import { Lock, Shield, Link as LinkIcon, Globe, Sparkles } from 'lucide-react'
import {
  PRIVACY_LABELS,
  SUBSCRIPTION_LABELS,
  asPrivacyLevel,
  asSubscriptionTier,
  type PrivacyLevel,
  type SubscriptionTier,
} from '@/lib/privacy'
import { cn } from '@/lib/utils'

/* ============================================================
   PrivacyBadge
   ------------------------------------------------------------
   A small elegant badge indicating a wedding's privacy level
   plus an optional "Canon Sealed" emblem.

   Display priority (only one renders):
     1. canonSealed      → gold wax-seal badge + shield icon
     2. private          → espresso "Private Vault" badge + lock
     3. link_only        → sage "Link Only" badge + link
     4. public           → champagne "Public" badge + globe

   The canon-sealed variant has a subtle pulse animation so it
   draws the eye — without being loud.

   Responsive: shrinks on small screens. Always ARIA-labelled so
   screen readers announce the privacy state.
   ============================================================ */

export interface PrivacyBadgeProps {
  privacy: PrivacyLevel | string | null | undefined
  canonSealed?: boolean | null
  tier?: SubscriptionTier | string | null
  /** Visual size of the badge. */
  size?: 'sm' | 'md' | 'lg'
  /** Show the subscription tier label next to the badge. Default false. */
  showTier?: boolean
  /** Extra classes on the outer motion span. */
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<PrivacyBadgeProps['size']>, string> = {
  sm: 'px-2.5 py-1 text-[10px] gap-1',
  md: 'px-3 py-1.5 text-xs gap-1.5',
  lg: 'px-4 py-2 text-sm gap-2',
}

const SIZE_ICON: Record<NonNullable<PrivacyBadgeProps['size']>, number> = {
  sm: 12,
  md: 14,
  lg: 16,
}

/* ── Canon-sealed badge (top priority) ───────────────────── */
function CanonSealedBadge({
  size,
  className,
}: {
  size: NonNullable<PrivacyBadgeProps['size']>
  className?: string
}) {
  const iconSize = SIZE_ICON[size]
  return (
    <motion.span
      role="status"
      aria-label="Canon Sealed — this wedding is preserved forever"
      className={cn(
        'inline-flex items-center rounded-full font-sans font-medium uppercase tracking-[0.15em]',
        'bg-gradient-to-br from-gold-light via-gold to-gold-muted text-espresso',
        'border border-gold/60 shadow-[0_2px_8px_-2px_rgba(191,155,95,0.5)]',
        SIZE_CLASSES[size],
        className,
      )}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Outer glow / pulse ring */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: '0 0 0 0 rgba(191,155,95,0.6)' }}
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(191,155,95,0.55)',
            '0 0 0 6px rgba(191,155,95,0)',
            '0 0 0 0 rgba(191,155,95,0)',
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.span
        aria-hidden="true"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-flex"
      >
        <Shield size={iconSize} strokeWidth={2.2} className="drop-shadow-sm" />
      </motion.span>
      <span className="font-semibold">Canon Sealed</span>
      <span aria-hidden="true" className="hidden sm:inline opacity-70">·</span>
      <span className="hidden sm:inline opacity-80 normal-case tracking-normal font-light">
        Preserved Forever
      </span>
    </motion.span>
  )
}

/* ── Privacy-level badges ────────────────────────────────── */

function PrivateVaultBadge({
  size,
  className,
}: {
  size: NonNullable<PrivacyBadgeProps['size']>
  className?: string
}) {
  const iconSize = SIZE_ICON[size]
  return (
    <motion.span
      role="status"
      aria-label="Private Vault — only the couple can view this wedding"
      className={cn(
        'inline-flex items-center rounded-full font-sans font-medium uppercase tracking-[0.15em]',
        'bg-espresso text-champagne border border-plum/40',
        SIZE_CLASSES[size],
        className,
      )}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Lock size={iconSize} strokeWidth={2.2} className="text-gold-light" />
      <span>Private Vault</span>
    </motion.span>
  )
}

function LinkOnlyBadge({
  size,
  className,
}: {
  size: NonNullable<PrivacyBadgeProps['size']>
  className?: string
}) {
  const iconSize = SIZE_ICON[size]
  return (
    <motion.span
      role="status"
      aria-label="Link Only — access requires a token from the invitation"
      className={cn(
        'inline-flex items-center rounded-full font-sans font-medium uppercase tracking-[0.15em]',
        'bg-sage/15 text-sage border border-sage/40',
        SIZE_CLASSES[size],
        className,
      )}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <LinkIcon size={iconSize} strokeWidth={2.2} />
      <span>{PRIVACY_LABELS.link_only}</span>
    </motion.span>
  )
}

function PublicBadge({
  size,
  className,
}: {
  size: NonNullable<PrivacyBadgeProps['size']>
  className?: string
}) {
  const iconSize = SIZE_ICON[size]
  return (
    <motion.span
      role="status"
      aria-label="Public — anyone with the link can view this wedding"
      className={cn(
        'inline-flex items-center rounded-full font-sans font-medium uppercase tracking-[0.15em]',
        'bg-champagne text-espresso border border-gold/30',
        SIZE_CLASSES[size],
        className,
      )}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Globe size={iconSize} strokeWidth={2.2} className="text-sage" />
      <span>{PRIVACY_LABELS.public}</span>
    </motion.span>
  )
}

/* ── Subscription tier pill ──────────────────────────────── */
function TierPill({
  tier,
  size,
  className,
}: {
  tier: SubscriptionTier
  size: NonNullable<PrivacyBadgeProps['size']>
  className?: string
}) {
  if (tier === 'free') return null
  const iconSize = Math.max(10, SIZE_ICON[size] - 2)
  const palette =
    tier === 'forever'
      ? 'bg-plum/12 text-plum border-plum/35'
      : 'bg-gold/12 text-gold border-gold/35'
  return (
    <motion.span
      aria-label={`Subscription tier: ${SUBSCRIPTION_LABELS[tier]}`}
      className={cn(
        'inline-flex items-center rounded-full font-sans font-medium uppercase tracking-[0.12em] normal-case',
        palette,
        SIZE_CLASSES[size],
        className,
      )}
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
      <Sparkles size={iconSize} strokeWidth={2.2} />
      <span className="capitalize tracking-normal">{SUBSCRIPTION_LABELS[tier]}</span>
    </motion.span>
  )
}

/* ── Main exported component ─────────────────────────────── */
export function PrivacyBadge({
  privacy,
  canonSealed,
  tier,
  size = 'md',
  showTier = false,
  className,
}: PrivacyBadgeProps) {
  const level = asPrivacyLevel(privacy)
  const sealed = Boolean(canonSealed)
  const tierValue = asSubscriptionTier(tier)

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      {sealed ? (
        <CanonSealedBadge size={size} />
      ) : level === 'private' ? (
        <PrivateVaultBadge size={size} />
      ) : level === 'link_only' ? (
        <LinkOnlyBadge size={size} />
      ) : (
        <PublicBadge size={size} />
      )}
      {showTier && <TierPill tier={tierValue} size={size} />}
    </span>
  )
}

export default PrivacyBadge
