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
    >
      {children}
    </NextThemesProvider>
  );
}
