'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarCheck,
  CircleHelp,
  Heart,
  Home,
  LogOut,
  MoreHorizontal,
  MoreVertical,
  Search,
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
  }).format(date).replaceAll('/', '.');
  return [initials, shortDate].filter(Boolean).join(' · ');
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
  const [activeSection, setActiveSection] = useState<string>('');
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
  const isCoupleOwner = accessKind === 'couple_owner' && viewerRole === 'couple';
  const showAdminLogout = viewerRole === 'admin';

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

  const leaveWedding = async () => {
    setLeaving(true);
    try {
      await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        method: 'DELETE',
      });
    } finally {
      window.location.href = '/';
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

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        data-testid="wedding-top-nav"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-espresso/95 shadow-lg backdrop-blur-md'
            : 'bg-gradient-to-b from-espresso/70 to-transparent backdrop-blur-sm'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Wedding navigation">
          <div className="flex flex-col">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('#home');
              }}
              className="font-serif text-xl font-light tracking-wider text-champagne transition-colors hover:text-gold sm:text-2xl"
            >
              wewed
            </a>
            <span className="wewed-monogram text-[9px] font-sans opacity-60">{monogram}</span>
          </div>

          <div className="hidden items-center gap-6 lg:flex">
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
            {isCoupleOwner && (
              <div className="hidden lg:block">
                <PlannerTrigger />
              </div>
            )}

            <div className="hidden lg:flex items-center">
              <BeforeAfterToggle />
            </div>

            <div className="hidden lg:block">
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
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-gold/20 bg-espresso/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
          <button
            type="button"
            onClick={() => handleNavClick('#home')}
            className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-champagne/80 transition hover:bg-gold/10 hover:text-gold"
          >
            <Home className="h-5 w-5" aria-hidden="true" />
            <span>Wedding</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('#rsvp')}
            className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-champagne/80 transition hover:bg-gold/10 hover:text-gold"
          >
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            <span>RSVP</span>
          </button>
          {showMyWedding && (
            <button
              type="button"
              data-testid="my-wedding-nav-cta"
              onClick={handleMyWedding}
              className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-gold/10 px-1 text-[10px] font-semibold text-gold transition hover:bg-gold/15"
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
              <span>My Wedding</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-champagne/80 transition hover:bg-gold/10 hover:text-gold"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="border-gold/20 bg-espresso/98 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg">
          <SheetTitle className="sr-only">Wedding menu</SheetTitle>
          <div className="flex flex-col items-center gap-1 pt-8">
            <p className="wewed-monogram mb-6 text-sm">{monogram}</p>

            {[...PRIMARY_NAV, ...SECONDARY_NAV].map((link, i) => {
              const isActive = activeSection === link.href;
              return (
                <motion.a
                  key={link.href}
                  href={link.href}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(link.href);
                  }}
                  className={`relative w-full py-3 text-center font-serif text-xl font-light tracking-wide transition-colors hover:text-gold ${
                    isActive ? 'text-gold' : 'text-champagne'
                  }`}
                >
                  {t(link.key)}
                </motion.a>
              );
            })}

            <div className="my-4 h-px w-24 bg-gold/20" />

            {showMyWedding && (
              <button
                type="button"
                onClick={handleMyWedding}
                className="inline-flex w-full items-center justify-center gap-2 py-3 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-gold"
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                My Wedding
              </button>
            )}
            <a
              href="/planners"
              className="inline-flex w-full items-center justify-center gap-2 py-3 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-champagne hover:text-gold"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Find a Planner
            </a>
            <a
              href="/guest-access-help"
              className="inline-flex w-full items-center justify-center gap-2 py-3 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-champagne hover:text-gold"
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
              Guest Help
            </a>
            <button
              type="button"
              onClick={() => void leaveWedding()}
              disabled={leaving}
              className="inline-flex w-full items-center justify-center gap-2 py-3 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-champagne/70 hover:text-gold disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {leaving ? 'Leaving…' : 'Leave Wedding'}
            </button>

            {isCoupleOwner && <div className="mt-6"><PlannerTrigger /></div>}
            {isCoupleOwner && <div className="mt-4"><QrGatewayTrigger onOpen={() => { setMobileOpen(false); setQrOpen(true); }} /></div>}

            <div className="mt-6 flex items-center gap-3">
              <ThemeToggle />
              <LanguageToggle size="sm" />
            </div>
            <div className="mt-4"><BeforeAfterToggle /></div>

            {showAdminLogout && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="mt-4 text-champagne/70 hover:text-gold"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Admin Logout
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {isCoupleOwner && <QrGateway open={qrOpen} onOpenChange={setQrOpen} />}
    </>
  );
}
