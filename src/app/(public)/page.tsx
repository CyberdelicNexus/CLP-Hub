import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, ClipboardList, Info, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { LandingNav } from "@/components/public/landing-nav";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { getOpenRecruitmentStudy } from "@/services/recruitment";

/**
 * Public landing shell. Phase 0 delivers the *design foundation* only: layout,
 * type scale, surface system and motion. Every string here is deliberately
 * generic placeholder copy — the real recruitment content is study
 * configuration and arrives from the database (Phase 5), never from this file
 * or the message catalogue. No trial specifics, no eligibility logic, and no
 * participant data is collected on this page (see D-003).
 */

const HIGHLIGHTS = [
  { key: "about", icon: Info, surface: "bg-surface-lilac text-surface-lilac-ink" },
  { key: "sessions", icon: CalendarDays, surface: "bg-surface-sky text-surface-sky-ink" },
  { key: "participation", icon: ClipboardList, surface: "bg-surface-mint text-surface-mint-ink" },
  { key: "contact", icon: MessageCircle, surface: "bg-surface-peach text-surface-peach-ink" },
] as const;

const STEPS = ["first", "second", "third"] as const;

export default async function PublicHomePage() {
  const t = await getTranslations("public.landing");
  const teamHref = `${TEAM_BASE_PATH}/login`;
  // The apply CTA appears only when a study is actually open for recruitment,
  // so the page never invites an application it cannot accept.
  const recruiting = (await getOpenRecruitmentStudy()) !== null;

  const navLinks = [
    { href: "#estudio", label: t("nav.study") },
    { href: "#proceso", label: t("nav.process") },
    { href: "#privacidad", label: t("nav.privacy") },
  ];

  return (
    <>
      <LandingNav
        brand={t("brand")}
        links={navLinks}
        teamHref={teamHref}
        teamLabel={t("teamAccess")}
      />

      <main id="main" className="flex-1">
        {/* Hero ------------------------------------------------------------ */}
        <section className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-28">
          <div
            aria-hidden
            className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-70 dark:opacity-40"
          />
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <span aria-hidden className="size-1.5 rounded-full bg-chart-3" />
                {t("badge")}
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold text-balance sm:text-6xl">
                {t("title")}
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
                {t("subtitle")}
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                {/* nativeButton={false}: these render anchors, not <button>. */}
                {recruiting ? (
                  <Button
                    render={<Link href="/participar" />}
                    nativeButton={false}
                    size="lg"
                    className="rounded-xl px-5"
                  >
                    {t("applyCta")}
                  </Button>
                ) : null}
                <Button
                  render={<a href="#estudio" />}
                  nativeButton={false}
                  variant={recruiting ? "outline" : "default"}
                  size="lg"
                  className="rounded-xl px-5"
                >
                  {t("primaryCta")}
                </Button>
                <Button
                  render={<Link href={teamHref} />}
                  nativeButton={false}
                  variant="outline"
                  size="lg"
                  className="rounded-xl px-5"
                >
                  {t("teamAccess")}
                </Button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Highlights bento ------------------------------------------------ */}
        <section id="estudio" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="max-w-2xl text-2xl font-semibold text-balance sm:text-3xl">
                {t("study.title")}
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">{t("study.description")}</p>
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HIGHLIGHTS.map(({ key, icon: Icon, surface }, i) => (
                <Reveal key={key} delay={i * 70}>
                  <article className="group h-full rounded-2xl bg-card p-5 ring-1 ring-foreground/10 transition-shadow duration-200 hover:shadow-lift">
                    <span
                      className={`inline-flex size-10 items-center justify-center rounded-xl ${surface}`}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-base font-medium">{t(`study.${key}.title`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`study.${key}.description`)}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Process --------------------------------------------------------- */}
        <section id="proceso" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl rounded-3xl bg-card p-6 ring-1 ring-foreground/10 sm:p-10">
            <Reveal>
              <h2 className="max-w-2xl text-2xl font-semibold text-balance sm:text-3xl">
                {t("process.title")}
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">{t("process.description")}</p>
            </Reveal>

            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal key={step} delay={i * 70}>
                  <li className="border-t border-border pt-5">
                    <span
                      data-numeric
                      className="text-xs font-medium text-muted-foreground"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-2 text-base font-medium">{t(`process.${step}.title`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`process.${step}.description`)}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy --------------------------------------------------------- */}
        <section id="privacidad" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <div className="mx-auto flex max-w-5xl flex-col gap-6 rounded-3xl bg-surface-mint p-6 sm:flex-row sm:items-center sm:p-10">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card/70 text-surface-mint-ink">
                <ShieldCheck className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-surface-mint-ink sm:text-2xl">
                  {t("privacy.title")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-surface-mint-ink/90">
                  {t("privacy.description")}
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Footer ---------------------------------------------------------- */}
        <footer className="mt-8 border-t border-border px-4 py-10 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{t("footer.note")}</p>
            <Link
              href={teamHref}
              className="inline-flex items-center gap-1.5 rounded-lg text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <LockKeyhole className="size-3.5" aria-hidden />
              {t("teamAccess")}
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
