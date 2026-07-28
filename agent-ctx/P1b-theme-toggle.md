# P1b — Mount ThemeProvider + build theme toggle

**Agent:** Z.ai Code (P1b)
**Task:** Mount `next-themes` ThemeProvider at the root layout, build a compact theme toggle (Light / Dark / System) and wire it into the navbar.

## Files Created
- `src/components/theme-provider.tsx` — `'use client'` wrapper around `next-themes` ThemeProvider. Config: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Forwards `...props` so future configs (e.g. `themes`, `storageKey`) can be overridden.
- `src/components/wedding/theme-toggle.tsx` — `'use client'` `ThemeToggle` component. Compact `ghost`+`icon` Button trigger with `border-gold/30 bg-espresso/40 backdrop-blur-sm` styling (matches LanguageToggle + BeforeAfterToggle). Trigger icon reflects the *resolved* theme (Sun in light, Moon in dark) so guests see what they're actually getting. Uses a `mounted` flag + dark placeholder icon to avoid hydration mismatch (next-themes returns `undefined` on the server). Dropdown uses shadcn `DropdownMenu` with espresso/gold content and Check mark on the active option.

## Files Modified
- `src/app/layout.tsx` — Imported `ThemeProvider` from `@/components/theme-provider`. Wrapped `{children}` + all body-level providers (`StoreRehydrator`, `Toaster`, `PWARegister`, `InstallPrompt`, `AdminTrigger`, `ProgressTrigger`, `AiTrigger`, `WhatsAppRSVP`) inside `<ThemeProvider>`. The existing `suppressHydrationWarning` on `<html>` and `<body>` was already present (next-themes needs it), so no change there. No imports or components were removed.
- `src/components/wedding/navbar.tsx` — Imported `ThemeToggle`. Added `<ThemeToggle />` to the right side of the desktop navbar (after `BeforeAfterToggle`, inside a `hidden sm:block` wrapper so it shows on tablet/desktop and stays out of the narrowest mobile bar where only the hamburger shows). Added `<ThemeToggle />` to the mobile Sheet drawer (after the lifecycle toggle, in a `mt-4` wrapper).

## Design Decisions
1. **Trigger icon = resolved theme, not preference.** Showing a Monitor when the user picked "System" but their OS is in light mode is confusing. The trigger now reflects what the user actually sees. The dropdown items show all three options (Light/Dark/System) with a Check on the *preference*.
2. **Hydration-safe.** `useTheme()` is undefined on the server. We render a Moon icon placeholder until `mounted` becomes true (in `useEffect`). The trigger button's `aria-label` also handles the unmounted state gracefully.
3. **Visual consistency.** The toggle uses the exact same border/background treatment (`border-gold/30 bg-espresso/40 backdrop-blur-sm`) as the existing `LanguageToggle` and `BeforeAfterToggle`, so the right side of the navbar reads as one cohesive control cluster.
4. **No CSS changes.** Per task constraints, `globals.css` was untouched. The existing `.dark` token set is activated by next-themes adding the `.dark` class to `<html>` (because `attribute="class"`).
5. **Wrap all body providers.** Putting `Toaster` and the trigger components inside `<ThemeProvider>` ensures any future theme-aware UI (toast styling, etc.) sees the correct theme tokens.

## Verification
- `bun run lint` — passed, no errors, no warnings.
- `dev.log` — Next.js 16.1.3 (Turbopack) compiled `/` successfully (`GET / 200 in 11.4s`). No build errors after edits.
- Click flow: clicking the trigger opens the dropdown; selecting Light/Dark/System calls `setTheme`, which sets the `class` attribute on `<html>` (`.dark` for dark, nothing for light) and persists to `localStorage`. The trigger icon updates immediately on next render.

## Notes for downstream agents
- The `ThemeToggle` exports a single named export `ThemeToggle`. No size variants (unlike `LanguageToggle`) because the dropdown menu already adapts; if a larger mobile variant is desired later, add a `size` prop.
- Theme persistence key is the next-themes default (`theme`). If you ever need to read the user's theme preference from the server, use the `next-themes` cookie approach (not currently enabled).
