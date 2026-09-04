import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getActiveQuestions, getOpenRecruitmentStudy } from "@/services/recruitment";
import { ApplicationForm, type RenderQuestion } from "./application-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.apply");
  return { title: t("title") };
}

/**
 * Public application form. Participants never authenticate (D-003), so this
 * page is anonymous: it renders the study's configured questions and posts to a
 * server action.
 *
 * When no study is open for recruitment the form is not rendered at all —
 * the closed state is decided on the server, not hidden with CSS.
 */
export default async function ApplyPage() {
  const t = await getTranslations("public.apply");
  const locale = await getLocale();
  const study = await getOpenRecruitmentStudy();
  const form = study ? await loadForm(study.id, locale) : null;

  return (
    <main id="main" className="relative flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-x-0 top-0 h-80 opacity-50 dark:opacity-25" />

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
          {form ? (
            <ApplicationForm
              questions={form.questions}
              renderedAt={form.renderedAt}
              labels={{
                submit: t("submit"),
                submitting: t("submitting"),
                optional: t("optional"),
                successTitle: t("successTitle"),
                successBody: t("successBody"),
                closed: t("closed"),
                failed: t("failed"),
                tooFast: t("tooFast"),
                requiredNote: t("requiredNote"),
                errors: {
                  required: t("error.required"),
                  invalidEmail: t("error.invalidEmail"),
                  invalidOption: t("error.invalidOption"),
                  tooLong: t("error.tooLong"),
                  invalidDate: t("error.invalidDate"),
                },
              }}
            />
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

/**
 * Question configuration → the shape the client component renders, plus the
 * server-stamped render time used by the fill-time floor. The timestamp is read
 * here rather than in the component so that rendering stays a pure function.
 */
async function loadForm(
  studyId: string,
  locale: string,
): Promise<{ questions: RenderQuestion[]; renderedAt: number }> {
  const questions = await getActiveQuestions(studyId);
  const pick = (es: string, en: string | null) => (locale === "en" && en ? en : es);

  const rendered = questions.map((q) => ({
    id: q.id,
    key: q.key,
    type: q.type,
    required: q.required,
    label: pick(q.labelEs, q.labelEn),
    help: q.helpEs ? pick(q.helpEs, q.helpEn) : null,
    options: (q.options ?? []).map((o) => ({
      value: o.value,
      label: locale === "en" && o.label_en ? o.label_en : o.label_es,
    })),
  }));

  return { questions: rendered, renderedAt: Date.now() };
}
