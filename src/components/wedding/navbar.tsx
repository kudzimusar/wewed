'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, MoreVertical, LogOut } from 'lucide-react';
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
import { isAdminLoggedIn, logoutAdmin } from '@/lib/admin-auth';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';

// 6 primary nav links (desktop) — clean, not crowded
const PRIMARY_NAV = [
  { key: 'nav.story', href: '#story' },
  { key: 'nav.theday', href: '#theday' },
  { key: 'nav.rsvp', href: '#rsvp' },
  { key: 'nav.songbook', href: '#songbook' },
  { key: 'nav.guests', href: '#guests' },
  { key: 'nav.faq', href: '#faq' },
] as const;

// Secondary links (in "More" dropdown)
const SECONDARY_NAV = [
  { key: 'nav.home', href: '#home' },
  { key: 'nav.venue', href: '#venue' },
  { key: 'nav.travel', href: '#travel' },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const t = useT();
  useLocale();

  // Dynamic monogram from wedding data context (multi-couple)
  const ctx = useWeddingContextSafe();
  const monogram = ctx?.getContent('hero', 'monogram', 'C&K · 23.12.26') || 'C&K · 23.12.26';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll-spy: track which section is currently in the viewport's reading band
  // and highlight the corresponding navbar link. Uses IntersectionObserver with
  // a rootMargin that focuses on the middle 30% of the viewport.
  useEffect(() => {
    const allLinks = [...PRIMARY_NAV, ...SECONDARY_NAV];
    const sectionIds = allLinks.map((l) => l.href.slice(1)); // strip '#'
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }
        // Pick the most-visible section
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

  // Check admin status after mount (client-only, no hydration mismatch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdminLoggedIn(isAdminLoggedIn());
  }, []);

  const handleLogout = () => {
    logoutAdmin();
    setAdminLoggedIn(false);
    window.location.reload();
  };

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-espresso/95 shadow-lg backdrop-blur-md'
            : 'bg-gradient-to-b from-espresso/70 to-transparent backdrop-blur-sm'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left — wordmark */}
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
            <span className="wewed-monogram text-[9px] font-sans opacity-60">
              {monogram}
            </span>
          </div>

          {/* Center — 6 primary nav links (desktop) */}
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
                    isActive
                      ? 'text-gold'
                      : 'text-champagne/85 hover:text-gold'
                  }`}
                >
                  {t(link.key)}
                  {/* Active underline indicator */}
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

          {/* Right — PLAN + BEFORE|AFTER toggle + More dropdown + hamburger */}
          <div className="flex items-center gap-2">
            {/* PLAN button (desktop) */}
            <div className="hidden md:block">
              <PlannerTrigger />
            </div>

            {/* BEFORE | AFTER toggle — visible on desktop, cool feature worth being public */}
            <div className="hidden sm:flex items-center">
              <BeforeAfterToggle />
            </div>

            {/* More dropdown — consolidates secondary links + toggles */}
            <div className="hidden sm:block">
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
                  className="w-56 border-gold/20 bg-espresso/98 text-champagne backdrop-blur-lg"
                >
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/70">
                    Explore
                  </DropdownMenuLabel>
                  {SECONDARY_NAV.map((link) => (
                    <DropdownMenuItem
                      key={link.href}
                      onClick={() => handleNavClick(link.href)}
                      className="cursor-pointer focus:bg-gold/10 focus:text-gold"
                    >
                      <span className="font-sans text-xs uppercase tracking-[0.15em]">
                        {t(link.key)}
                      </span>
                    </DropdownMenuItem>
                  ))}

                  <DropdownMenuItem
                    onClick={() => setQrOpen(true)}
                    className="cursor-pointer focus:bg-gold/10 focus:text-gold"
                  >
                    <span className="font-sans text-xs uppercase tracking-[0.15em]">QR & Share</span>
                  </DropdownMenuItem>

                  {adminLoggedIn && (
                    <>
                      <DropdownMenuSeparator className="bg-gold/20" />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="cursor-pointer focus:bg-gold/10 focus:text-gold"
                      >
                        <LogOut className="mr-2 h-4 w-4 text-gold/70" />
                        <span className="font-sans text-xs uppercase tracking-[0.15em]">Logout</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator className="bg-gold/20" />
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/70">
                    Settings
                  </DropdownMenuLabel>

                  {/* Toggles in a row */}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <ThemeToggle />
                    <LanguageToggle size="sm" />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="text-champagne hover:bg-transparent hover:text-gold lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="border-gold/20 bg-espresso/98 backdrop-blur-lg"
        >
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
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
                  {isActive && (
                    <span
                      className="absolute left-1/2 top-1/2 h-8 w-px -translate-y-1/2 bg-gold/40"
                      aria-hidden="true"
                      style={{ left: 'calc(50% - 2.5rem)' }}
                    />
                  )}
                </motion.a>
              );
            })}

            <div className="mt-6"><PlannerTrigger /></div>
            <div className="mt-4"><QrGatewayTrigger onOpen={() => { setMobileOpen(false); setQrOpen(true); }} /></div>

            <div className="mt-6 flex items-center gap-3">
              <ThemeToggle />
              <LanguageToggle size="sm" />
            </div>
            <div className="mt-4"><BeforeAfterToggle /></div>

            {adminLoggedIn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="mt-4 text-champagne/70 hover:text-gold"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Logout
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* QR Gateway modal */}
      <QrGateway open={qrOpen} onOpenChange={setQrOpen} />
    </>
  );
}
