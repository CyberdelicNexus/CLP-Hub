"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme boundary. `attribute="class"` writes `.dark` onto <html>, which is what
 * the `@custom-variant dark` rule in globals.css keys off. The preference is a
 * device-local rendering choice stored in localStorage by next-themes — unlike
 * the locale it is not part of the staff profile and is not audited.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // next-themes renders an inline <script> that sets the theme before
      // paint. It only needs to run from the server HTML; when React renders
      // it on the client, React 19 warns "Encountered a script tag while
      // rendering" (2026-10-28 report). On the client it is marked as a data
      // block, which React does not flag, and the attribute difference is
      // expected rather than a hydration error.
      scriptProps={{
        type: typeof window === "undefined" ? undefined : "application/json",
        suppressHydrationWarning: true,
      }}
    >
      {children}
    </NextThemesProvider>
  );
}
