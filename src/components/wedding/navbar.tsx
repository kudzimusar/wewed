'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarCheck,
  Check,
  ChevronDown,
  CircleHelp,
  Heart,
  Home,
  LogOut,
  MoreHorizontal,
  MoreVertical,
  Search,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { BeforeAfterToggle } from '@/components/wedding/before-after-toggle';
import { LanguageToggle } from '@/components/wedding/language-toggle';
import { PlannerTrigger } from '@/components/wedding/planner-trigger';
import { ThemeToggle } from '@/components/wedding/theme-toggle';
import { QrGateway, QrGatewayTrigger } from '@/components/wedding/qr-gateway';
import { useLocale, useT } from '@/lib/i18n';
import { logoutAdmin } from '@/lib/admin-auth';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';
import type {
  PublicWeddingAccessKind,
  WeddingViewerRole,
} from '@/lib/wedding-access-kind';

const PRIMARY_NAV = [
  { key: 'nav.story', href: '#story' },
  { key: 'nav.theday', href: '#theday' },
  { key: 'nav.rsvp', href: '#rsvp' },
  { key: 'nav.songbook', href: '#songbook' },
  { key: 'nav.guests', href: '#guests' },
  { key: 'nav.faq', href: '#faq' },
] as const;

const SECONDARY_NAV = [
  { key: 'nav.home', href: '#home' },
  { key: 'nav.venue', href: '#venue' },
  { key: 'nav.travel', href: '#travel' },
] as const;

const MOBILE_DRAWER_NAV = [
  { key: 'nav.story', href: '#story' },
  { key: 'nav.theday', href: '#theday' },
  { key: 'nav.venue', href: '#venue' },
  { key: 'nav.travel', href: '#travel' },
  { key: 'nav.songbook', href: '#songbook' },
  { key: 'nav.guests', href: '#guests' },
  { key: 'nav.faq', href: '#faq' },
] as const;

interface GuestWeddingSummary {
  weddingId: string;
  slug: string;
  coupleNames: string;
  date: string;
  monogram: string | null;
  invitationCardStyle: string;
}

function fallbackInitials(partner1?: string, partner2?: string): string {
  return [partner1?.trim()?.[0], partner2?.trim()?.[0]]
    .filter(Boolean)
    .join('') || 'W';
}

function fallbackMonogram(
  partner1?: string,
  partner2?: string,
  dateValue?: string,
): string {
  const initials = [partner1?.trim()?.[0], partner2?.trim()?.[0]]
    .filter(Boolean)
    .join('&');
  if (!dateValue) return initials || 'Wewed';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return initials || 'Wewed';
  const shortDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date).replaceAll('/', '.');
  return [initials, shortDate].filter(Boolean).join(' · ');
}

function mobileWeddingDate(dateValue?: string): string {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date).toUpperCase();
}

export function Navbar({
  slug,
  accessKind = null,
  viewerRole = null,
  showMyWedding = false,
  onMyWedding,
}: {
  slug: string;
  accessKind?: PublicWeddingAccessKind;
  viewerRole?: WeddingViewerRole;
  showMyWedding?: boolean;
  onMyWedding?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [guestWeddings, setGuestWeddings] = useState<GuestWeddingSummary[]>([]);
  const [switchingWedding, setSwitchingWedding] = useState<string | null>(null);
  const t = useT();
  useLocale();

  const ctx = useWeddingContextSafe();
  const wedding = ctx?.wedding;
  const generatedMonogram = fallbackMonogram(
    wedding?.couple.partner1,
    wedding?.couple.partner2,
    wedding?.date,
  );
  const monogram =
    ctx?.getContent('hero', 'monogram', wedding?.monogram || generatedMonogram) ||
    generatedMonogram;
  const identityMonogram =
    wedding?.monogram || fallbackInitials(wedding?.couple.partner1, wedding?.couple.partner2);
  const coupleNames = [wedding?.couple.partner1, wedding?.couple.partner2]
    .filter(Boolean)
    .join(' & ') || 'Our Wedding';
  const weddingDate = mobileWeddingDate(wedding?.date);
  const isCoupleOwner = accessKind === 'couple_owner' && viewerRole === 'couple';
  const showAdminLogout = viewerRole === 'admin';
  const canSwitchWedding = accessKind === 'invited_guest' && guestWeddings.length > 1;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (accessKind !== 'public' || !showMyWedding) return;
    const current = new URL(window.location.href);
    if (
      current.pathname === `/w/${encodeURIComponent(slug)}` &&
      current.searchParams.get('site') === '1'
    ) {
      current.searchParams.delete('site');
      const clean = `${current.pathname}${current.search}${current.hash}`;
      window.history.replaceState(window.history.state, '', clean);
    }
  }, [accessKind, showMyWedding, slug]);

  useEffect(() => {
    if (accessKind !== 'invited_guest') {
      setGuestWeddings([]);
      return;
    }

    let active = true;
    void fetch('/api/guest-weddings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ weddings?: GuestWeddingSummary[] }>;
      })
      .then((payload) => {
        if (!active || !payload) return;
        setGuestWeddings(Array.isArray(payload.weddings) ? payload.weddings : []);
      })
      .catch(() => {
        if (active) setGuestWeddings([]);
      });

    return () => {
      active = false;
    };
  }, [accessKind, slug]);

  useEffect(() => {
    const allLinks = [...PRIMARY_NAV, ...SECONDARY_NAV];
    const sectionIds = allLinks.map((l) => l.href.slice(1));
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
          else visible.delete(entry.target.id);
        }
        let bestId = '';
        let bestRatio = 0;
        visible.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        setActiveSection(bestId ? `#${bestId}` : '');
      },
      {
        rootMargin: '-40% 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleLogout = () => {
    logoutAdmin();
    window.location.reload();
  };

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleMyWedding = () => {
    setMobileOpen(false);
    onMyWedding?.();
  };

  const handleShare = async () => {
    // The share surface is intentionally wedding-scoped, never guest-scoped. Do not
    // copy the current URL because invitation/card/session query state can be personal.
    const websiteUrl = `${window.location.origin}/w/${encodeURIComponent(slug)}`;
    const shareData = {
      title: `${coupleNames} Wedding`,
      text: weddingDate ? `${coupleNames} · ${weddingDate}` : coupleNames,
      url: websiteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(websiteUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2_000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  };

  const switchWedding = async (weddingId: string) => {
    if (switchingWedding) return;
    setSwitchingWedding(weddingId);
    try {
      const response = await fetch('/api/guest-weddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { destination?: string }
        | null;
      if (!response.ok || !payload?.destination) return;
      window.location.assign(payload.destination);
    } finally {
      setSwitchingWedding(null);
    }
  };

  const leaveWedding = async () => {
    setLeaving(true);
    let next = '/';
    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => null)) as { next?: string } | null;
      if (response.ok && payload?.next) next = payload.next;
    } finally {
      window.location.href = next;
    }
  };

  const platformMenuItems = (
    <>
      {showMyWedding && (
        <DropdownMenuItem
          onClick={handleMyWedding}
          className="cursor-pointer focus:bg-gold/10 focus:text-gold"
          data-testid="desktop-my-wedding-menu-cta"
        >
          <Heart className="mr-2 h-4 w-4 text-gold/70" />
          <span className="font-sans text-xs uppercase tracking-[0.15em]">My Wedding</span>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem asChild className="cursor-pointer focus:bg-gold/10 focus:text-gold">
        <a href="/planners">
          <Search className="mr-2 h-4 w-4 text-gold/70" />
          <span className="font-sans text-xs uppercase tracking-[0.15em]">Find a Planner</span>
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild className="cursor-pointer focus:bg-gold/10 focus:text-gold">
        <a href="/guest-access-help">
          <CircleHelp className="mr-2 h-4 w-4 text-gold/70" />
          <span className="font-sans text-xs uppercase tracking-[0.15em]">Guest Help</span>
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => void leaveWedding()}
        disabled={leaving}
        className="cursor-pointer focus:bg-gold/10 focus:text-gold"
      >
        <LogOut className="mr-2 h-4 w-4 text-gold/70" />
        <span className="font-sans text-xs uppercase tracking-[0.15em]">
          {leaving ? 'Leaving…' : 'Leave Wedding'}
        </span>
      </DropdownMenuItem>
    </>
  );

  const mobileIdentity = (
    <button
      type="button"
      data-testid="mobile-wedding-identity"
      onClick={canSwitchWedding ? undefined : () => handleNavClick('#home')}
      aria-label={canSwitchWedding ? 'Switch wedding' : 'Go to wedding home'}
      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left text-espresso transition hover:bg-white/15"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-espresso/20 bg-espresso font-serif text-sm tracking-[0.12em] text-gold shadow-sm">
        {identityMonogram}
      </span>
      <span className="min-w-0 flex-1">
        <span
          data-testid="mobile-wedding-couple-names"
          className="block truncate font-serif text-[17px] font-medium leading-tight tracking-[0.025em] text-espresso"
        >
          {coupleNames}
        </span>
        {weddingDate && (
          <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.22em] text-espresso/65">
            {weddingDate}
          </span>
        )}
      </span>
      {canSwitchWedding && (
        <ChevronDown className="h-4 w-4 shrink-0 text-espresso/70" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        data-testid="wedding-top-nav"
        className={`fixed left-0 right-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-500 lg:pt-0 ${
          scrolled
            ? 'bg-[#dec37e] shadow-lg backdrop-blur-xl lg:bg-espresso/95'
            : 'bg-[#ead8a9] shadow-sm backdrop-blur-md lg:bg-gradient-to-b lg:from-espresso/75 lg:via-espresso/30 lg:to-transparent lg:shadow-none lg:backdrop-blur-[2px]'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-2.5 sm:px-6 lg:px-8" aria-label="Wedding navigation">
          <div
            data-testid="mobile-wedding-top-nav"
            className="flex w-full items-center gap-1.5 lg:hidden"
          >
            {canSwitchWedding ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>{mobileIdentity}</DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="w-[min(86vw,340px)] border-espresso/15 bg-[#f5e7c4] p-2 text-espresso shadow-2xl"
                >
                  <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-espresso/55">
                    My Weddings
                  </DropdownMenuLabel>
                  {guestWeddings.map((item) => {
                    const current = item.slug === slug;
                    const itemDate = mobileWeddingDate(item.date);
                    return (
                      <DropdownMenuItem
                        key={item.weddingId}
                        disabled={Boolean(switchingWedding)}
                        onClick={() => {
                          if (!current) void switchWedding(item.weddingId);
                        }}
                        className="min-h-14 cursor-pointer rounded-xl px-3 py-2 focus:bg-espresso/10 focus:text-espresso"
                      >
                        <div className="flex w-full items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-espresso font-serif text-xs tracking-[0.08em] text-gold">
                            {item.monogram || item.coupleNames.split(/\s*&\s*/).map((name) => name[0]).join('')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-serif text-base">{item.coupleNames}</p>
                            <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-espresso/55">
                              {itemDate}
                            </p>
                          </div>
                          {current && <Check className="h-4 w-4 shrink-0 text-espresso" aria-hidden="true" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              mobileIdentity
            )}

            <button
              type="button"
              data-testid="mobile-wedding-share"
              onClick={() => void handleShare()}
              aria-label={shareCopied ? 'Wedding website link copied' : 'Share Website'}
              title={shareCopied ? 'Website link copied' : 'Share Website'}
              className="flex h-11 w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-espresso/20 bg-white/25 text-espresso shadow-sm transition hover:bg-white/40"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span className="text-[8px] font-bold uppercase leading-none tracking-[0.08em]">
                {shareCopied ? 'Copied' : 'Share Website'}
              </span>
            </button>
          </div>

          <div className="hidden w-full items-center justify-between lg:flex">
            <div className="flex flex-col">
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('#home');
                }}
                className="font-serif text-2xl font-light tracking-wider text-champagne transition-colors hover:text-gold"
              >
                wewed
              </a>
              <span className="wewed-monogram text-[9px] font-sans opacity-60">{monogram}</span>
            </div>

            <div className="flex items-center gap-6">
              {PRIMARY_NAV.map((link) => {
                const isActive = activeSection === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }}
                    className={`group relative font-sans text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200 ${
                      isActive ? 'text-gold' : 'text-champagne/85 hover:text-gold'
                    }`}
                  >
                    {t(link.key)}
                    <span
                      className={`absolute -bottom-1.5 left-1/2 h-px -translate-x-1/2 bg-gold transition-all duration-300 ${
                        isActive ? 'w-full opacity-100' : 'w-0 opacity-0'
                      }`}
                      aria-hidden="true"
                    />
                  </a>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {isCoupleOwner && <PlannerTrigger />}
              <BeforeAfterToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="More options"
                    className="h-9 w-9 rounded-full border border-gold/30 bg-espresso/40 text-champagne backdrop-blur-sm transition-colors hover:bg-gold/10 hover:text-gold"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-60 border-gold/20 bg-espresso/98 text-champagne backdrop-blur-lg"
                >
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/70">Wedding</DropdownMenuLabel>
                  {SECONDARY_NAV.map((link) => (
                    <DropdownMenuItem
                      key={link.href}
                      onClick={() => handleNavClick(link.href)}
                      className="cursor-pointer focus:bg-gold/10 focus:text-gold"
                    >
                      <span className="font-sans text-xs uppercase tracking-[0.15em]">{t(link.key)}</span>
                    </DropdownMenuItem>
                  ))}

                  {isCoupleOwner && (
                    <DropdownMenuItem
                      onClick={() => setQrOpen(true)}
                      className="cursor-pointer focus:bg-gold/10 focus:text-gold"
                    >
                      <span className="font-sans text-xs uppercase tracking-[0.15em]">QR & Share</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator className="bg-gold/20" />
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/70">Wewed</DropdownMenuLabel>
                  {platformMenuItems}

                  {showAdminLogout && (
                    <>
                      <DropdownMenuSeparator className="bg-gold/20" />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="cursor-pointer focus:bg-gold/10 focus:text-gold"
                      >
                        <LogOut className="mr-2 h-4 w-4 text-gold/70" />
                        <span className="font-sans text-xs uppercase tracking-[0.15em]">Admin Logout</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator className="bg-gold/20" />
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/70">Settings</DropdownMenuLabel>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <ThemeToggle />
                    <LanguageToggle size="sm" />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </nav>
      </motion.header>

      <nav
        data-testid="mobile-wedding-bottom-nav"
        aria-label="Wedding app navigation"
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-gold/20 bg-espresso/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5">
          <button
            type="button"
            data-testid="mobile-nav-home"
            onClick={() => handleNavClick('#home')}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition ${
              activeSection === '#home' || !activeSection
                ? 'text-gold'
                : 'text-champagne/75 hover:text-gold'
            }`}
          >
            <Home className="h-5 w-5" aria-hidden="true" />
            <span>Home</span>
          </button>
          <button
            type="button"
            data-testid="mobile-nav-rsvp"
            onClick={() => handleNavClick('#rsvp')}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition ${
              activeSection === '#rsvp'
                ? 'text-gold'
                : 'text-champagne/75 hover:text-gold'
            }`}
          >
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            <span>RSVP</span>
          </button>
          {showMyWedding && (
            <button
              type="button"
              data-testid="my-wedding-nav-cta"
              onClick={handleMyWedding}
              className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold text-gold transition hover:bg-gold/8"
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
              <span>My Wedding</span>
            </button>
          )}
          <button
            type="button"
            data-testid="mobile-nav-more"
            aria-expanded={mobileOpen}
            aria-controls="mobile-wedding-more-drawer"
            onClick={() => setMobileOpen(true)}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition ${
              mobileOpen ? 'text-gold' : 'text-champagne/75 hover:text-gold'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          id="mobile-wedding-more-drawer"
          side="right"
          data-testid="mobile-wedding-more-drawer"
          className="w-[82vw] max-w-[340px] overflow-y-auto border-l border-gold/25 bg-espresso/98 px-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-champagne shadow-[-24px_0_60px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:max-w-[360px]"
        >
          <SheetTitle className="sr-only">Wedding menu</SheetTitle>

          <div className="flex min-h-full flex-col text-left">
            <div className="border-b border-gold/15 px-6 pb-5 pr-12">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/45 bg-gold/5 font-serif text-sm tracking-[0.12em] text-gold">
                  {identityMonogram}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg font-light text-champagne">{coupleNames}</p>
                  {weddingDate && (
                    <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-gold/75">
                      {weddingDate}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-3 py-5">
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-gold/65">
                Explore the wedding
              </p>
              <div className="flex flex-col">
                {MOBILE_DRAWER_NAV.map((link, i) => {
                  const isActive = activeSection === link.href;
                  return (
                    <motion.a
                      key={link.href}
                      href={link.href}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.035, duration: 0.24 }}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavClick(link.href);
                      }}
                      className={`rounded-xl px-3 py-2.5 font-serif text-[19px] font-light tracking-[0.015em] transition-colors ${
                        isActive
                          ? 'bg-gold/8 text-gold'
                          : 'text-champagne/92 hover:bg-white/5 hover:text-gold'
                      }`}
                    >
                      {t(link.key)}
                    </motion.a>
                  );
                })}
              </div>
            </div>

            <div className="mx-6 h-px bg-gold/18" />

            <div className="px-3 py-5">
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-gold/65">
                Wewed
              </p>
              <a
                href="/planners"
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-champagne/88 transition hover:bg-white/5 hover:text-gold"
              >
                <Search className="h-[18px] w-[18px] text-gold/75" aria-hidden="true" />
                <span>Find a Planner</span>
              </a>
              <a
                href="/guest-access-help"
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-champagne/88 transition hover:bg-white/5 hover:text-gold"
              >
                <CircleHelp className="h-[18px] w-[18px] text-gold/75" aria-hidden="true" />
                <span>Guest Help</span>
              </a>
            </div>

            {isCoupleOwner && (
              <>
                <div className="mx-6 h-px bg-gold/18" />
                <div className="space-y-3 px-6 py-5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-gold/65">
                    Manage
                  </p>
                  <PlannerTrigger />
                  <QrGatewayTrigger onOpen={() => { setMobileOpen(false); setQrOpen(true); }} />
                </div>
              </>
            )}

            <div className="mt-auto px-6 pb-4 pt-3">
              <div className="mb-4 flex items-center gap-3 border-t border-gold/15 pt-4">
                <ThemeToggle />
                <LanguageToggle size="sm" />
                <BeforeAfterToggle />
              </div>

              {showAdminLogout && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="mb-2 w-full justify-start px-0 text-champagne/65 hover:bg-transparent hover:text-gold"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Admin Logout
                </Button>
              )}

              <button
                type="button"
                onClick={() => void leaveWedding()}
                disabled={leaving}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-gold/20 px-3 py-2 text-left text-sm text-gold/85 transition hover:bg-gold/8 disabled:opacity-50"
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
                <span>{leaving ? 'Leaving…' : 'Leave Wedding'}</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {isCoupleOwner && <QrGateway open={qrOpen} onOpenChange={setQrOpen} />}
    </>
  );
}
