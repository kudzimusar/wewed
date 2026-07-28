/**
 * wewed — lightweight i18n dictionary (English + Shona)
 *
 * Strategy: a flat key→string dictionary keyed by `Locale`. We deliberately
 * avoid refactoring every component through next-intl's `<FormattedMessage>`
 * machinery; instead, components read from this dictionary via the `t()`
 * helper (which reads the active locale from the zustand store) or via the
 * `useLocale()` hook for reactive switching.
 *
 * Shona translations are crafted to be authentic and respectful. Where the
 * English term is in common use even among Shona speakers (e.g. "RSVP"),
 * we keep the English string in both locales — this matches real Zimbabwean
 * wedding communication norms.
 */

import { useWewedStore } from '@/lib/store';

export type Locale = 'en' | 'sn';

/** All keys the dictionary knows about. Add new keys here first. */
export type TranslationKey = keyof typeof translations.en;

/**
 * The translation dictionary. Each locale must define the same set of keys.
 */
export const translations = {
  en: {
    // ── Navigation ────────────────────────────────────────────────
    'nav.home': 'Home',
    'nav.story': 'Our Story',
    'nav.theday': 'The Day',
    'nav.rsvp': 'RSVP',
    'nav.travel': 'Travel & Stay',
    'nav.songbook': 'Songbook',
    'nav.guests': 'Guests',
    'nav.faq': 'FAQ',
    'nav.registry': 'Registry',
    'nav.venue': 'Venue',
    'nav.before': 'BEFORE',
    'nav.after': 'AFTER',

    // ── Hero ──────────────────────────────────────────────────────
    'hero.countdown_label': 'Counting the moments until forever',
    'hero.scroll': 'Scroll to begin',
    'hero.tagline': 'Where love lives forever',

    // ── RSVP ──────────────────────────────────────────────────────
    'rsvp.heading': 'RSVP',
    'rsvp.subtext': 'Tell us if you will be joining us on our special day.',
    'rsvp.submit': 'Send Your RSVP',
    'rsvp.fullName': 'Full Name',
    'rsvp.email': 'Email',
    'rsvp.attendance': 'Will you attend?',
    'rsvp.accept': 'Joyfully Accept',
    'rsvp.decline': 'Regretfully Decline',
    'rsvp.meal': 'Meal Preference',
    'rsvp.message': 'Message to the Couple',

    // ── Songbook ──────────────────────────────────────────────────
    'songbook.heading': 'The Songbook',
    'songbook.ceremony': 'Ceremony',
    'songbook.reception': 'Reception',
    'songbook.firstDance': 'First Dance',
    'songbook.requests': 'Guest Requests',
    'songbook.vote': 'Vote',

    // ── Guests / Wedding Party ────────────────────────────────────
    'guests.heading': 'The Wedding Party',
    'guests.guide': 'Cultural Guide',

    // ── Travel & Stay ─────────────────────────────────────────────
    'travel.heading': 'Travel & Stay',
    'travel.gettingThere': 'Getting There',
    'travel.whereToStay': 'Where to Stay',

    // ── Common ────────────────────────────────────────────────────
    'common.loading': 'Loading…',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',

    // ── Footer ────────────────────────────────────────────────────
    'footer.tagline': 'Where love lives forever',

    // ── Save the date / misc shared strings ───────────────────────
    'common.saveTheDate': 'Save the Date',
    'common.getDirections': 'Get Directions',
  },

  sn: {
    // ── Navigation ────────────────────────────────────────────────
    'nav.home': 'Pekugara',
    'nav.story': 'Nyaya Yedu',
    'nav.theday': 'Zuva Rino',
    'nav.rsvp': 'RSVP',
    'nav.travel': 'Kufamba Nokugara',
    'nav.songbook': 'Nharembofu',
    'nav.guests': 'Vatori Vezuva',
    'nav.faq': 'Mibvunzo Nemapinduri',
    'nav.registry': 'Zvipiro',
    'nav.venue': 'Nzvimbo',
    'nav.before': 'BEFORE',
    'nav.after': 'AFTER',

    // ── Hero ──────────────────────────────────────────────────────
    'hero.countdown_label': 'Kuverenga nguva kusvika nokusingaperi',
    'hero.scroll': 'Tsvaira kudzikira kuti utange',
    'hero.tagline': 'Kwakagara rudo nokusingaperi',

    // ── RSVP ──────────────────────────────────────────────────────
    'rsvp.heading': 'RSVP',
    'rsvp.subtext': 'Tidzezei kana uchauya zuva rino rifadza rofadza.',
    'rsvp.submit': 'Tumira RSVP Yako',
    'rsvp.fullName': 'Zita Rako',
    'rsvp.email': 'Tsamba Yemhando Nharo (Email)',
    'rsvp.attendance': 'Uchauya here?',
    'rsvp.accept': 'Ndatenda, ndichauya',
    'rsvp.decline': 'Ndine urombo, handikwanise kuuya',
    'rsvp.meal': 'Chikafwa Chaunoda',
    'rsvp.message': 'Tsamba Kwavari',

    // ── Songbook ──────────────────────────────────────────────────
    'songbook.heading': 'Nharembofu',
    'songbook.ceremony': 'Muchato',
    'songbook.reception': 'Gungano',
    'songbook.firstDance': 'Kutamba Kwekutanga',
    'songbook.requests': 'Zvinodiwa neVatambi',
    'songbook.vote': 'Vhota',

    // ── Guests / Wedding Party ────────────────────────────────────
    'guests.heading': 'Vatori Vezuva',
    'guests.guide': 'Tungamira Wemagariro',

    // ── Travel & Stay ─────────────────────────────────────────────
    'travel.heading': 'Kufamba Nokugara',
    'travel.gettingThere': 'Kusvika Ikoko',
    'travel.whereToStay': 'Kugara Papi',

    // ── Common ────────────────────────────────────────────────────
    'common.loading': 'Kuunza…',
    'common.save': 'Chengeta',
    'common.cancel': 'Kanza',
    'common.close': 'Vhara',

    // ── Footer ────────────────────────────────────────────────────
    'footer.tagline': 'Kwakagara rudo nokusingaperi',

    // ── Save the date / misc shared strings ───────────────────────
    'common.saveTheDate': 'Chengeta Zuva',
    'common.getDirections': 'Tora Nzira',
  },
} as const;

/**
 * Get the translation for a key in a specific locale.
 * Falls back to English if the key is somehow missing in the requested locale,
 * then to the raw key as a last resort (so devs always see *something*).
 */
export function translate(locale: Locale, key: TranslationKey): string {
  const fromLocale = translations[locale]?.[key];
  if (fromLocale) return fromLocale as string;
  const fallback = translations.en[key];
  if (fallback) return fallback as string;
  return key as string;
}

/**
 * Reactive hook: returns the current locale from zustand.
 * Use this in components that need to re-render on locale change.
 */
export function useLocale(): Locale {
  return useWewedStore((s) => s.locale);
}

/**
 * Reactive translation hook: returns a `t` function bound to the current
 * locale. Whenever the locale in the store changes, the component re-renders
 * and `t()` returns strings for the new locale.
 *
 * @example
 * const t = useT();
 * <h1>{t('rsvp.heading')}</h1>
 */
export function useT(): (key: TranslationKey) => string {
  const locale = useLocale();
  return (key: TranslationKey) => translate(locale, key);
}

/**
 * Non-reactive translator: reads the current locale from the zustand store
 * via `getState()`. Useful outside React (utilities, event handlers) or
 * when you want to avoid subscribing to locale changes.
 *
 * For reactive UI, prefer `useT()`.
 */
export function t(key: TranslationKey): string {
  const locale = useWewedStore.getState().locale;
  return translate(locale, key);
}

/**
 * Human-readable label for a locale, useful for display in toggles.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  sn: 'SN',
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  sn: 'chiShona',
};
