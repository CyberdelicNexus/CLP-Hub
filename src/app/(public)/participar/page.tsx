import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getOpenRecruitmentStudy } from "@/services/recruitment";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.apply");
  return { title: t("title") };
}

/**
 * Public recruitment page.
 *
 * THIS PAGE COLLECTS NOTHING. It used to host CLP Hub's own application form;
 * that form is retired (D-031). Initial screening happens in Qualtrics, and the
 * digital consent is accepted there *before* any datum about the person — their
 * name included — is collected. A form here would necessarily collect a name
 * before that consent existed, which is precisely the order the study must not
 * work in.
 *
 * So this is a hand-off: an explanation and one outbound link. There is no form
 * element, no server action, no input of any kind, and nothing is written to the
 * database when someone visits. The destination is `studies.screening_url`,
 * configured per study (non-negotiable 6) and constrained to https in SQL.
 *
 * When recruitment is closed, or no screening URL is configured, the link is not
 * rendered at all — decided on the server, never hidden with CSS.
 */
export default async function ApplyPage() {
  const t = await getTranslations("public.apply");
  const study = await getOpenRecruitmentStudy();
  const screeningUrl = study?.screeningUrl ?? null;

  return (
    <main id="main" className="relative flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none absolute inset-x-0 top-0 h-80 opacity-50 dark:opacity-25"
      />

      <div className="relative mx-auto w-full max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
          <ThemeToggle />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">{t("intro")}</p>

        <div className="mt-8 rounded-2xl bg-card p-6 shadow-soft ring-1 ring-foreground/10 sm:p-8">
          {screeningUrl ? (
            <>
              <h2 className="text-lg font-medium">{t("handoffTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("handoffBody")}
              </p>

              <ol className="mt-5 space-y-3 text-sm">
                {(["consent", "questions", "contact"] as const).map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span
                      data-numeric
                      aria-hidden
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-lilac text-xs font-medium text-surface-lilac-ink"
                    >
                      {i + 1}
                    </span>
                    <span className="leading-relaxed text-muted-foreground">
                      {t(`handoffStep.${step}`)}
                    </span>
                  </li>
                ))}
              </ol>

              {/*
                An ordinary outbound link. `noopener`/`noreferrer` because the
                destination is a third party, and `rel="external"` so the hand-off
                is explicit in the markup rather than only in the copy.
              */}
              <a
                href={screeningUrl}
                target="_blank"
                rel="external noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-shadow hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t("handoffCta")}
                <ArrowUpRight className="size-4" aria-hidden />
              </a>

              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("handoffConsentNote")}</span>
              </p>
            </>
          ) : (
            <div>
              <h2 className="text-lg font-medium">{t("closedTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("closed")}</p>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{t("privacyNote")}</p>
      </div>
    </main>
  );
}
