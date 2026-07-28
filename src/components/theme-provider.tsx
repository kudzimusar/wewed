'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * ThemeProvider — wraps `next-themes` for the wewed platform.
 *
 * - `attribute="class"` toggles the `.dark` class on <html>, which activates
 *   the existing `.dark` token set in `src/app/globals.css`.
 * - `defaultTheme="system"` + `enableSystem` lets guests inherit their OS theme.
 * - `disableTransitionOnChange` prevents the color flash on first paint and on
 *   theme switches (wewed has many framer-motion transitions that would otherwise
 *   fight with CSS color transitions).
 *
 * Mount once in `src/app/layout.tsx`, wrapping {children}.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
