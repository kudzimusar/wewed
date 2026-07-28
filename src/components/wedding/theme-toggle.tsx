'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ThemeOption = 'light' | 'dark' | 'system';

const THEME_META: Record<
  ThemeOption,
  { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }
> = {
  light: { label: 'Light', icon: Sun, hint: 'Bright champagne' },
  dark: { label: 'Dark', icon: Moon, hint: 'Espresso noir' },
  system: { label: 'System', icon: Monitor, hint: 'Match device' },
};

/**
 * ThemeToggle — a compact dropdown for switching between Light / Dark / System.
 *
 * - Designed to live in the wewed navbar alongside LanguageToggle and
 *   BeforeAfterToggle, so it inherits the gold-on-espresso accent language.
 * - The trigger shows the *resolved* theme's icon (so guests see a Sun when
 *   light is active, Moon when dark is active, even if their preference is
 *   "system"). This avoids the "I picked System, why is the icon a monitor?"
 *   confusion.
 * - Renders a stable placeholder icon until mounted to avoid hydration
 *   mismatch — `useTheme()` returns `undefined` on the server.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // The icon we show on the trigger reflects the *resolved* theme (what the
  // user is actually seeing), not their preference. Before mount, we render
  // the Moon icon as a neutral placeholder to keep the navbar layout stable.
  const triggerIconKey: ThemeOption = mounted
    ? resolvedTheme === 'dark'
      ? 'dark'
      : 'light'
    : 'dark';
  const TriggerIcon = THEME_META[triggerIconKey].icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${mounted ? THEME_META[(theme as ThemeOption) || 'system'].label : 'System'}. Click to change theme.`}
          className={cn(
            'h-9 w-9 rounded-full border border-gold/30 bg-espresso/40 text-champagne backdrop-blur-sm',
            'transition-colors duration-200 hover:bg-espresso/60 hover:text-gold',
            'focus-visible:text-gold focus-visible:ring-gold/40',
            className,
          )}
        >
          <TriggerIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-48 border-gold/20 bg-espresso/98 text-champagne backdrop-blur-lg"
      >
        {(Object.keys(THEME_META) as ThemeOption[]).map((option) => {
          const { label, icon: Icon, hint } = THEME_META[option];
          const isActive = mounted && theme === option;
          return (
            <DropdownMenuItem
              key={option}
              onSelect={() => setTheme(option)}
              className={cn(
                'group flex cursor-pointer items-center gap-3 px-3 py-2',
                'focus:bg-gold/10 focus:text-gold',
                isActive && 'text-gold',
              )}
            >
              <Icon className="h-4 w-4 text-gold/80 group-focus:text-gold" aria-hidden="true" />
              <div className="flex flex-1 flex-col">
                <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em]">
                  {label}
                </span>
                <span className="font-sans text-[10px] text-champagne/55 group-focus:text-gold/70">
                  {hint}
                </span>
              </div>
              {isActive && <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
