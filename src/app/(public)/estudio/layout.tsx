import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { A11yContentWrapper, AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { PageFade } from "@/components/page-fade";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Frame for the public study pages.
 *
 * These pages carry NO participant data and are byte-identical for every
 * reader (docs/research-data-boundaries.md, open item 5). There is no session,
 * no personalisation and nothing that varies by who is reading — which is what
 * makes it safe to hand the link out in an email or a WhatsApp message.
 *
 * `<main>` has no top padding and no max-width of its own (2026-09-19
 * follow-up: "update the cover to fill the whole page and always at the top
 * of the page") — a page's own cover, when it has one, needs to render
 * full-bleed as the very first thing on the page, before any padding or
 * column constrains it. That pushes the horizontal max-width and the
 * padding down into each page component instead of centralising it here;
 * both public page templates share the identical wrapper now. The back
 * link, text-size control and theme toggle become a floating overlay
 * (`glass-panel`, same "chrome over content" pattern as the team header)
 * rather than a block above the content, so nothing sits above the cover —
 * and pages with no cover still clear it via top padding on their own
 * content wrapper. The text-size control used to float separately as its
 * own vertical panel on the right edge; moved into this same header bar
 * (2026-09-29 request) since on a phone it sat cramped right next to the
 * reading column instead of reading as navigation chrome.
 */
export default async function StudyContentLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("public.study");

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none absolute inset-x-0 top-0 h-72 opacity-40 dark:opacity-20"
      />

      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 px-4 pt-4 sm:px-6">
        <div className="glass-panel pointer-events-auto mx-auto flex w-full max-w-3xl items-center justify-between rounded-2xl px-3 py-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("backHome")}
          </Link>
          <div className="flex items-center gap-1">
            <AccessibilityToolbar />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="relative flex-1">
        <PageFade>
          <A11yContentWrapper>{children}</A11yContentWrapper>
        </PageFade>
      </main>

      {/* A quiet sign-off, not the informational blurb this replaced
          (2026-09-29 request) — just the mark, no link, no claim. */}
      <footer className="relative border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl justify-center">
          <Image src="/brand/logo.png" alt="Clear Light" width={28} height={28} className="size-7 opacity-70" />
        </div>
      </footer>
    </div>
  );
}
