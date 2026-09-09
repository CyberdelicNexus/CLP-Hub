import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Frame for the public study pages.
 *
 * These pages carry NO participant data and are byte-identical for every
 * reader (docs/research-data-boundaries.md, open item 5). There is no session,
 * no personalisation and nothing that varies by who is reading — which is what
 * makes it safe to hand the link out in an email or a WhatsApp message.
 */
export default async function StudyContentLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("public.study");

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none absolute inset-x-0 top-0 h-72 opacity-40 dark:opacity-20"
      />

      <header className="relative px-4 pt-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("backHome")}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="relative flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </main>

      <footer className="relative border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("footerNote")}</p>
        </div>
      </footer>
    </div>
  );
}
