import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/**
 * Typography pairing (see docs/design-system.md):
 * - display: Plus Jakarta Sans — geometric-humanist, carries the soft modern
 *   character in headings and metrics.
 * - body: Geist — neutral and highly legible at small sizes for dense UI.
 * The CSS variable names are consumed by the `@theme inline` block in
 * globals.css as --font-display / --font-body.
 */
const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});
const body = Geist({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "CLP Hub", template: "%s · CLP Hub" },
  description: "Plataforma operativa del estudio",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    // suppressHydrationWarning is required by next-themes: it writes the theme
    // class onto <html> before hydration to avoid a flash of the wrong theme.
    <html
      lang={locale}
      suppressHydrationWarning
      // Tells the router that the smooth scrolling in globals.css is deliberate,
      // so it suppresses it during route transitions instead of warning. Without
      // it, navigating between team sections animates the scroll back to the top
      // — which reads as lag on a page that has already changed.
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
